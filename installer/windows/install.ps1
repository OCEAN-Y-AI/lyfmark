#requires -Version 5.1

[CmdletBinding()]
param(
	[string]$InstallInfoPath = "",
	[string]$CoreVersion = "1.0",
	[string]$CorePackageUrl = "",
	[string]$GithubRepositoryUrl = "",
	[string]$InstallDirectory = (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "LyfMark"),
	[string]$ProjectName = "",
	[switch]$Yes,
	[string]$GitName = "",
	[string]$GitEmail = "",
	[string]$SshComment = "",
	[switch]$SkipToolInstall,
	[switch]$SkipSsh,
	[switch]$SkipVSCode,
	[switch]$SkipOpenWorkspace,
	[switch]$AdminToolInstallOnly,
	[switch]$NoPause
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp.com 65001 | Out-Null
$script:EffectiveProjectName = ""
$script:InitialBoundParameters = @{} + $PSBoundParameters
$script:BootstrapSource = $MyInvocation.MyCommand.ScriptBlock.ToString()
$script:TemporaryBootstrapScriptPath = ""

function Write-Step {
	param([string]$Message)
	Write-Host ""
	Write-Host "[lyfmark-install] $Message"
}

function Test-Windows {
	return [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
}

function Test-Administrator {
	$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
	$principal = New-Object Security.Principal.WindowsPrincipal($identity)
	return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-CommandAvailable {
	param([string]$Name)
	return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Add-PathIfExists {
	param([string]$PathToAdd)
	if ([string]::IsNullOrWhiteSpace($PathToAdd) -or -not (Test-Path -LiteralPath $PathToAdd)) {
		return
	}
	$paths = $env:Path -split [IO.Path]::PathSeparator
	if ($paths -notcontains $PathToAdd) {
		$env:Path = "$PathToAdd$([IO.Path]::PathSeparator)$env:Path"
	}
}

function Update-CurrentProcessPath {
	$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
	$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
	$env:Path = @($machinePath, $userPath, $env:Path) -join [IO.Path]::PathSeparator

	Add-PathIfExists (Join-Path $env:ProgramFiles "nodejs")
	Add-PathIfExists (Join-Path $env:ProgramFiles "Git\cmd")
	Add-PathIfExists (Join-Path $env:ProgramFiles "Git\usr\bin")
	Add-PathIfExists (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\bin")
	Add-PathIfExists (Join-Path $env:ProgramFiles "Microsoft VS Code\bin")
}

# Creates a repeated backslash run for Windows command-line argument quoting.
function New-BackslashString {
	param([int]$Count)
	if ($Count -le 0) {
		return ""
	}
	return "".PadLeft($Count, [char]92)
}

# Quotes one native argument for Windows PowerShell 5.1, where ProcessStartInfo.ArgumentList is unavailable.
function ConvertTo-NativeArgument {
	param([string]$Argument)

	if ($null -eq $Argument -or $Argument.Length -eq 0) {
		return '""'
	}
	if ($Argument -notmatch '[\s"]') {
		return $Argument
	}

	$builder = New-Object System.Text.StringBuilder
	[void]$builder.Append('"')
	$backslashCount = 0
	foreach ($character in $Argument.ToCharArray()) {
		if ($character -eq '\') {
			$backslashCount += 1
			continue
		}
		if ($character -eq '"') {
			[void]$builder.Append((New-BackslashString (($backslashCount * 2) + 1)))
			[void]$builder.Append('"')
			$backslashCount = 0
			continue
		}
		if ($backslashCount -gt 0) {
			[void]$builder.Append((New-BackslashString $backslashCount))
			$backslashCount = 0
		}
		[void]$builder.Append($character)
	}
	if ($backslashCount -gt 0) {
		[void]$builder.Append((New-BackslashString ($backslashCount * 2)))
	}
	[void]$builder.Append('"')
	return $builder.ToString()
}

function Join-NativeArguments {
	param([string[]]$Arguments)

	$nativeArguments = @()
	foreach ($argument in $Arguments) {
		$nativeArguments += ConvertTo-NativeArgument $argument
	}
	return $nativeArguments -join " "
}

# Provides a physical script path for elevated re-entry even when LyfMark was started from an in-memory script block.
function Get-ReentryScriptPath {
	if (-not [string]::IsNullOrWhiteSpace($PSCommandPath) -and (Test-Path -LiteralPath $PSCommandPath)) {
		return [IO.Path]::GetFullPath($PSCommandPath)
	}

	if (-not [string]::IsNullOrWhiteSpace($script:TemporaryBootstrapScriptPath) -and (Test-Path -LiteralPath $script:TemporaryBootstrapScriptPath)) {
		return $script:TemporaryBootstrapScriptPath
	}

	if ([string]::IsNullOrWhiteSpace($script:BootstrapSource)) {
		throw "LyfMark was started without a readable script source. Download installer/windows/install.ps1 to a file and run it with PowerShell."
	}

	$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) "lyfmark-installer"
	New-Item -ItemType Directory -Force -Path $temporaryDirectory | Out-Null
	$temporaryPath = Join-Path $temporaryDirectory ("install-" + [guid]::NewGuid().ToString("N") + ".ps1")
	Set-Content -LiteralPath $temporaryPath -Value $script:BootstrapSource -Encoding UTF8
	$script:TemporaryBootstrapScriptPath = $temporaryPath
	return $temporaryPath
}

function Remove-TemporaryBootstrapScript {
	if ([string]::IsNullOrWhiteSpace($script:TemporaryBootstrapScriptPath)) {
		return
	}
	if (Test-Path -LiteralPath $script:TemporaryBootstrapScriptPath) {
		Remove-Item -LiteralPath $script:TemporaryBootstrapScriptPath -Force -ErrorAction SilentlyContinue
	}
}

# Runs native commands outside the PowerShell pipeline so output stays visible without corrupting function return values.
function Invoke-NativeCommand {
	param(
		[string]$Command,
		[string[]]$Arguments,
		[string]$Label,
		[string]$WorkingDirectory = "",
		[bool]$CloseStandardInput = $false,
		[int]$KeepAliveSeconds = 0
	)

	Write-Host "[lyfmark-install] $Label"

	$startInfo = New-Object System.Diagnostics.ProcessStartInfo
	$startInfo.FileName = $Command
	$startInfo.Arguments = Join-NativeArguments $Arguments
	$startInfo.UseShellExecute = $false
	$startInfo.RedirectStandardOutput = $false
	$startInfo.RedirectStandardError = $false
	$startInfo.RedirectStandardInput = $CloseStandardInput
	$startInfo.CreateNoWindow = $false
	if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
		$startInfo.WorkingDirectory = $WorkingDirectory
	}

	$process = New-Object System.Diagnostics.Process
	$process.StartInfo = $startInfo
	$processStarted = $false

	try {
		if (-not $process.Start()) {
			throw "$Label failed to start."
		}
		$processStarted = $true
		if ($CloseStandardInput) {
			$process.StandardInput.Close()
		}
		$lastKeepAlive = Get-Date
		while (-not $process.WaitForExit(250)) {
			if ($KeepAliveSeconds -gt 0 -and ((Get-Date) - $lastKeepAlive).TotalSeconds -ge $KeepAliveSeconds) {
				Write-Host "[lyfmark-install] Still working: $Label"
				$lastKeepAlive = Get-Date
			}
		}
		$exitCode = $process.ExitCode
	} catch {
		if ($processStarted -and -not $process.HasExited) {
			$process.Kill()
			$process.WaitForExit()
		}
		throw
	} finally {
		$process.Dispose()
	}

	if ($exitCode -ne 0) {
		if ($exitCode -eq 3010) {
			throw "$Label requires a Windows restart. Restart Windows and run LyfMark again."
		}
		throw "$Label failed with exit code $exitCode."
	}
}

function Invoke-NativeCommandCapture {
	param(
		[string]$Command,
		[string[]]$Arguments,
		[string]$Label,
		[string]$WorkingDirectory = ""
	)

	$startInfo = New-Object System.Diagnostics.ProcessStartInfo
	$startInfo.FileName = $Command
	$startInfo.Arguments = Join-NativeArguments $Arguments
	$startInfo.UseShellExecute = $false
	$startInfo.RedirectStandardOutput = $true
	$startInfo.RedirectStandardError = $true
	$startInfo.RedirectStandardInput = $false
	$startInfo.CreateNoWindow = $true
	if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
		$startInfo.WorkingDirectory = $WorkingDirectory
	}

	$process = New-Object System.Diagnostics.Process
	$process.StartInfo = $startInfo
	$processStarted = $false

	try {
		if (-not $process.Start()) {
			throw "$Label failed to start."
		}
		$processStarted = $true
		$stdout = $process.StandardOutput.ReadToEnd()
		$stderr = $process.StandardError.ReadToEnd()
		while (-not $process.WaitForExit(250)) {
		}
		$exitCode = $process.ExitCode
	} catch {
		if ($processStarted -and -not $process.HasExited) {
			$process.Kill()
			$process.WaitForExit()
		}
		throw
	} finally {
		$process.Dispose()
	}

	if ($exitCode -ne 0) {
		$details = $stderr.Trim()
		if ([string]::IsNullOrWhiteSpace($details)) {
			$details = $stdout.Trim()
		}
		if ([string]::IsNullOrWhiteSpace($details)) {
			throw "$Label failed with exit code $exitCode."
		}
		throw "$Label failed with exit code $exitCode. $details"
	}

	return $stdout.Trim()
}

function Invoke-NativeCommandQuiet {
	param(
		[string]$Command,
		[string[]]$Arguments,
		[string]$Label,
		[string]$WorkingDirectory = ""
	)

	[void](Invoke-NativeCommandCapture $Command $Arguments $Label $WorkingDirectory)
}

function Get-InstallInfoValue {
	param(
		[object]$InstallInfo,
		[string[]]$Names
	)

	foreach ($name in $Names) {
		$property = $InstallInfo.PSObject.Properties[$name]
		if ($null -ne $property) {
			return $property.Value
		}
	}
	return $null
}

function Set-StringParameterFromInstallInfo {
	param(
		[object]$InstallInfo,
		[string]$ParameterName,
		[string[]]$InfoNames
	)

	if ($script:InitialBoundParameters.ContainsKey($ParameterName)) {
		return
	}

	$value = Get-InstallInfoValue $InstallInfo $InfoNames
	if ($null -eq $value) {
		return
	}

	$text = ([string]$value).Trim()
	if ($text.Length -eq 0) {
		return
	}

	Set-Variable -Name $ParameterName -Scope Script -Value $text
}

function Set-SwitchParameterFromInstallInfo {
	param(
		[object]$InstallInfo,
		[string]$ParameterName,
		[string[]]$InfoNames
	)

	if ($script:InitialBoundParameters.ContainsKey($ParameterName)) {
		return
	}

	$value = Get-InstallInfoValue $InstallInfo $InfoNames
	if ($null -eq $value) {
		return
	}

	if ($value -is [bool]) {
		Set-Variable -Name $ParameterName -Scope Script -Value $value
		return
	}

	$text = ([string]$value).Trim().ToLowerInvariant()
	if (@("1", "true", "yes", "y") -contains $text) {
		Set-Variable -Name $ParameterName -Scope Script -Value $true
		return
	}
	if (@("0", "false", "no", "n") -contains $text) {
		Set-Variable -Name $ParameterName -Scope Script -Value $false
		return
	}

	throw "Install info value '$ParameterName' must be true or false."
}

function Import-InstallInfo {
	if ([string]::IsNullOrWhiteSpace($InstallInfoPath)) {
		return
	}

	$resolvedPath = [IO.Path]::GetFullPath($InstallInfoPath)
	if (-not (Test-Path -LiteralPath $resolvedPath)) {
		throw "Install info file was not found: $resolvedPath"
	}

	try {
		$installInfo = Get-Content -LiteralPath $resolvedPath -Raw | ConvertFrom-Json
	} catch {
		throw "Install info file is not valid JSON: $resolvedPath"
	}
	if ($null -eq $installInfo -or $installInfo -is [array]) {
		throw "Install info file must contain one JSON object: $resolvedPath"
	}

	Set-StringParameterFromInstallInfo $installInfo "CoreVersion" @("coreVersion")
	Set-StringParameterFromInstallInfo $installInfo "CorePackageUrl" @("corePackageUrl")
	Set-StringParameterFromInstallInfo $installInfo "GithubRepositoryUrl" @("githubRepositoryUrl", "githubRepoUrl", "repositoryUrl")
	Set-StringParameterFromInstallInfo $installInfo "InstallDirectory" @("installDirectory", "targetDirectory")
	Set-StringParameterFromInstallInfo $installInfo "ProjectName" @("projectName", "websiteName")
	Set-StringParameterFromInstallInfo $installInfo "GitName" @("gitName")
	Set-StringParameterFromInstallInfo $installInfo "GitEmail" @("gitEmail")
	Set-StringParameterFromInstallInfo $installInfo "SshComment" @("sshComment")
	Set-SwitchParameterFromInstallInfo $installInfo "Yes" @("yes", "nonInteractive")
	Set-SwitchParameterFromInstallInfo $installInfo "SkipToolInstall" @("skipToolInstall")
	Set-SwitchParameterFromInstallInfo $installInfo "SkipSsh" @("skipSsh")
	Set-SwitchParameterFromInstallInfo $installInfo "SkipVSCode" @("skipVSCode")
	Set-SwitchParameterFromInstallInfo $installInfo "SkipOpenWorkspace" @("skipOpenWorkspace")
	Set-SwitchParameterFromInstallInfo $installInfo "NoPause" @("noPause")
}

function Get-SafeProjectName {
	param([string]$RawName)

	$name = ""
	if ($null -ne $RawName) {
		$name = $RawName.Trim()
	}
	if ([string]::IsNullOrWhiteSpace($name)) {
		throw "Project name must not be empty."
	}

	foreach ($invalidCharacter in [IO.Path]::GetInvalidFileNameChars()) {
		$name = $name.Replace($invalidCharacter, "-")
	}
	$name = [regex]::Replace($name, "\s+", " ").Trim().TrimEnd([char[]]@(".", " "))
	if ([string]::IsNullOrWhiteSpace($name)) {
		throw "Project name must contain at least one valid folder character."
	}

	$reservedNames = @("CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9")
	if ($reservedNames -contains $name.ToUpperInvariant()) {
		throw "Project name '$name' is reserved by Windows. Choose another name."
	}

	return $name
}

function Resolve-ProjectName {
	if (-not [string]::IsNullOrWhiteSpace($ProjectName)) {
		return Get-SafeProjectName $ProjectName
	}
	if ($Yes) {
		return "lyfmark-website"
	}

	for (;;) {
		$answer = Read-Host "Project / website name (used as folder name)"
		try {
			return Get-SafeProjectName $answer
		} catch {
			Write-Host "[lyfmark-install] $($_.Exception.Message)"
		}
	}
}

function ConvertTo-ArgumentList {
	param(
		[string]$ResolvedProjectName,
		[bool]$ToolInstallOnly = $false
	)

	$arguments = @(
		"-NoProfile",
		"-ExecutionPolicy", "Bypass",
		"-File", "`"$(Get-ReentryScriptPath)`"",
		"-CoreVersion", "`"$CoreVersion`"",
		"-CorePackageUrl", "`"$CorePackageUrl`"",
		"-GithubRepositoryUrl", "`"$GithubRepositoryUrl`"",
		"-InstallDirectory", "`"$InstallDirectory`"",
		"-ProjectName", "`"$ResolvedProjectName`""
	)

	if ($Yes) {
		$arguments += "-Yes"
	}
	if (-not [string]::IsNullOrWhiteSpace($GitName)) {
		$arguments += @("-GitName", "`"$GitName`"")
	}
	if (-not [string]::IsNullOrWhiteSpace($GitEmail)) {
		$arguments += @("-GitEmail", "`"$GitEmail`"")
	}
	if (-not [string]::IsNullOrWhiteSpace($SshComment)) {
		$arguments += @("-SshComment", "`"$SshComment`"")
	}
	if ($SkipToolInstall) {
		$arguments += "-SkipToolInstall"
	}
	if ($SkipSsh) {
		$arguments += "-SkipSsh"
	}
	if ($SkipVSCode) {
		$arguments += "-SkipVSCode"
	}
	if ($SkipOpenWorkspace) {
		$arguments += "-SkipOpenWorkspace"
	}
	if ($ToolInstallOnly) {
		$arguments += "-AdminToolInstallOnly"
	}
	if ($NoPause) {
		$arguments += "-NoPause"
	}

	return $arguments
}

function Test-ToolInstallNeeded {
	Update-CurrentProcessPath
	if (-not (Test-CommandAvailable "git")) {
		return $true
	}
	if (-not (Test-CommandAvailable "node")) {
		return $true
	}
	if (-not (Test-CommandAvailable "npm")) {
		return $true
	}
	if (-not $SkipSsh -and -not (Test-CommandAvailable "ssh-keygen")) {
		return $true
	}
	if (-not $SkipVSCode -and -not (Test-CommandAvailable "code")) {
		return $true
	}
	return $false
}

function Invoke-ElevatedToolInstallIfNeeded {
	if ($SkipToolInstall -or (Test-Administrator) -or -not (Test-ToolInstallNeeded)) {
		return
	}

	Write-Step "Requesting administrator permission"
	Write-Host "[lyfmark-install] Windows may ask for permission once so LyfMark can install required programs."
	$argumentList = ConvertTo-ArgumentList $script:EffectiveProjectName $true
	if ($argumentList -notcontains "-NoPause") {
		$argumentList += "-NoPause"
	}
	$process = Start-Process -FilePath "powershell.exe" -ArgumentList $argumentList -Verb RunAs -Wait -PassThru
	if ($process.ExitCode -ne 0) {
		throw "Administrator tool installation failed with exit code $($process.ExitCode)."
	}

	Update-CurrentProcessPath
	if (Test-ToolInstallNeeded) {
		throw "Administrator tool installation finished, but required programs are still unavailable. Restart Windows and run LyfMark again."
	}
}

function Install-WingetPackage {
	param(
		[string]$PackageId,
		[string]$DisplayName,
		[string]$ProbeCommand
	)

	Update-CurrentProcessPath
	if (Test-CommandAvailable $ProbeCommand) {
		Write-Host "[lyfmark-install] $DisplayName is already available."
		return
	}

	if ($SkipToolInstall) {
		throw "$DisplayName is missing and automatic tool installation is disabled."
	}

	if (-not (Test-CommandAvailable "winget")) {
		throw "winget was not found. Install Microsoft App Installer and start LyfMark again."
	}

	Write-Step "Installing $DisplayName"
	Invoke-NativeCommand "winget" @(
		"install",
		"--id", $PackageId,
		"--exact",
		"--source", "winget",
		"--accept-package-agreements",
		"--accept-source-agreements",
		"--disable-interactivity",
		"--silent"
	) "winget install $PackageId" -CloseStandardInput $true -KeepAliveSeconds 15

	Update-CurrentProcessPath
	if (-not (Test-CommandAvailable $ProbeCommand)) {
		throw "$DisplayName was installed but is still unavailable in this process. Restart Windows and run LyfMark again."
	}
}

function Ensure-RequiredTools {
	Write-Step "Checking required programs"
	Update-CurrentProcessPath

	Install-WingetPackage "Git.Git" "Git" "git"
	Install-WingetPackage "OpenJS.NodeJS.LTS" "Node.js LTS" "node"

	Update-CurrentProcessPath
	if (-not (Test-CommandAvailable "npm")) {
		throw "npm is missing although Node.js is available. Reinstall Node.js LTS and start LyfMark again."
	}
	if (-not $SkipSsh -and -not (Test-CommandAvailable "ssh-keygen")) {
		throw "ssh-keygen is missing. Reinstall Git for Windows and start LyfMark again."
	}

	if (-not $SkipVSCode) {
		Install-WingetPackage "Microsoft.VisualStudioCode" "Visual Studio Code" "code"
	}
}

function Get-ProjectDirectory {
	New-Item -ItemType Directory -Force -Path $InstallDirectory | Out-Null
	return Join-Path $InstallDirectory $script:EffectiveProjectName
}

function Get-CorePackageUrl {
	if (-not [string]::IsNullOrWhiteSpace($CorePackageUrl)) {
		return $CorePackageUrl
	}
	return "https://github.com/OCEAN-Y-AI/lyfmark/releases/download/core-v$CoreVersion/lyfmark-core-$CoreVersion.zip"
}

function Copy-CorePackage {
	param(
		[string]$ResolvedPackageUrl,
		[string]$TargetPackagePath
	)

	if (Test-Path -LiteralPath $ResolvedPackageUrl) {
		Copy-Item -LiteralPath $ResolvedPackageUrl -Destination $TargetPackagePath -Force
		return
	}

	Invoke-WebRequest -Uri $ResolvedPackageUrl -OutFile $TargetPackagePath
}

function Expand-CorePackage {
	param(
		[string]$PackagePath,
		[string]$ProjectDirectory
	)

	New-Item -ItemType Directory -Force -Path $ProjectDirectory | Out-Null
	Expand-Archive -LiteralPath $PackagePath -DestinationPath $ProjectDirectory -Force
}

function Initialize-CustomerGitRepository {
	param([string]$ProjectDirectory)

	if (-not (Test-Path -LiteralPath (Join-Path $ProjectDirectory ".git"))) {
		Invoke-NativeCommand "git" @("-C", $ProjectDirectory, "init") "Initialize customer Git repository"
	}
	Invoke-NativeCommand "git" @("config", "--global", "--add", "safe.directory", $ProjectDirectory) "Trust customer Git directory"
	Invoke-NativeCommand "git" @("-C", $ProjectDirectory, "branch", "-M", "main") "Set customer Git branch to main"
}

function Install-ProjectSources {
	$projectDirectory = Get-ProjectDirectory
	$packageJsonPath = Join-Path $projectDirectory "package.json"

	if (Test-Path -LiteralPath $packageJsonPath) {
		Write-Host "[lyfmark-install] Existing LyfMark project found: $projectDirectory"
		Initialize-CustomerGitRepository $projectDirectory
		return $projectDirectory
	}

	if (Test-Path -LiteralPath $projectDirectory) {
		$existingEntries = @(Get-ChildItem -LiteralPath $projectDirectory -Force)
		if ($existingEntries.Count -gt 0) {
			throw "The target folder already exists but is not a LyfMark project: $projectDirectory"
		}
	}

	Write-Step "Downloading LyfMark Core package"
	$resolvedPackageUrl = Get-CorePackageUrl
	$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("lyfmark-core-" + [guid]::NewGuid().ToString("N"))
	New-Item -ItemType Directory -Force -Path $temporaryDirectory | Out-Null
	$packagePath = Join-Path $temporaryDirectory "lyfmark-core.zip"
	try {
		Copy-CorePackage $resolvedPackageUrl $packagePath
		Expand-CorePackage $packagePath $projectDirectory
	} finally {
		Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
	}
	if (-not (Test-Path -LiteralPath $packageJsonPath)) {
		throw "The LyfMark Core package did not contain package.json at its root. Package: $resolvedPackageUrl"
	}
	Initialize-CustomerGitRepository $projectDirectory
	return $projectDirectory
}

function Invoke-ProjectWizard {
	param([string]$ProjectDirectory)

	Write-Step "Setting up LyfMark project"
	$wizardArguments = @("tools\installer\wizard.mjs")
	if ($Yes) {
		if ([string]::IsNullOrWhiteSpace($GitName) -or [string]::IsNullOrWhiteSpace($GitEmail)) {
			throw "-Yes requires -GitName and -GitEmail."
		}
		$wizardArguments += "--yes"
		$wizardArguments += @("--git-name", $GitName)
		$wizardArguments += @("--git-email", $GitEmail)
		if (-not [string]::IsNullOrWhiteSpace($SshComment)) {
			$wizardArguments += @("--ssh-comment", $SshComment)
		}
	}
	if ($SkipSsh) {
		$wizardArguments += "--skip-ssh"
	}

	$previousBootstrapFinalizes = $env:LYFMARK_INSTALLER_BOOTSTRAP_FINALIZES
	try {
		$env:LYFMARK_INSTALLER_BOOTSTRAP_FINALIZES = "1"
		Invoke-NativeCommand "node" $wizardArguments "Run LyfMark installer" $ProjectDirectory
	} finally {
		$env:LYFMARK_INSTALLER_BOOTSTRAP_FINALIZES = $previousBootstrapFinalizes
	}
}

function Install-LyfMarkVsCodeExtension {
	param([string]$ProjectDirectory)

	if ($SkipVSCode) {
		return
	}

	$installerPath = Join-Path $ProjectDirectory "tools\lyfmark-vscode\install-local-extension.mjs"
	if (-not (Test-Path -LiteralPath $installerPath)) {
		Write-Host "[lyfmark-install] LyfMark VS Code extension installer was not found. Continuing without extension setup."
		return
	}

	Write-Step "Installing LyfMark VS Code extension"
	$codeCli = Get-CodeCliPath
	if (-not [string]::IsNullOrWhiteSpace($codeCli)) {
		$env:LYFMARK_VSCODE_CLI_PATH = $codeCli
	}
	Invoke-NativeCommand "node" @($installerPath) "Install LyfMark VS Code extension" $ProjectDirectory
}

function Get-CodeCliPath {
	$candidates = @()
	if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
		$candidates += (Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\bin\code.cmd")
	}
	if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
		$candidates += (Join-Path $env:ProgramFiles "Microsoft VS Code\bin\code.cmd")
	}
	if (-not [string]::IsNullOrWhiteSpace(${env:ProgramFiles(x86)})) {
		$candidates += (Join-Path ${env:ProgramFiles(x86)} "Microsoft VS Code\bin\code.cmd")
	}
	foreach ($candidate in $candidates) {
		if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
			return $candidate
		}
	}

	$command = Get-Command "code" -ErrorAction SilentlyContinue
	if ($command) {
		return $command.Source
	}

	return ""
}

function Get-CodeExecutablePath {
	$candidates = @(
		(Join-Path $env:LOCALAPPDATA "Programs\Microsoft VS Code\Code.exe"),
		(Join-Path $env:ProgramFiles "Microsoft VS Code\Code.exe")
	)
	foreach ($candidate in $candidates) {
		if (Test-Path -LiteralPath $candidate) {
			return $candidate
		}
	}

	$command = Get-Command "code" -ErrorAction SilentlyContinue
	if ($command) {
		return $command.Source
	}

	return ""
}

function Get-CustomerWorkspacePath {
	param([string]$ProjectDirectory)
	return Join-Path $ProjectDirectory ".vscode\lyfmark.customer.code-workspace"
}

function New-DesktopWorkspaceShortcut {
	param([string]$ProjectDirectory)

	if ($SkipVSCode) {
		return
	}

	$codeExecutable = Get-CodeExecutablePath
	if ([string]::IsNullOrWhiteSpace($codeExecutable)) {
		Write-Host "[lyfmark-install] Visual Studio Code command is not available yet. Desktop shortcut was not created."
		return
	}

	$workspacePath = Get-CustomerWorkspacePath $ProjectDirectory
	if (-not (Test-Path -LiteralPath $workspacePath)) {
		Write-Host "[lyfmark-install] Customer workspace was not found. Desktop shortcut was not created."
		return
	}

	$desktopPath = [Environment]::GetFolderPath("DesktopDirectory")
	if ([string]::IsNullOrWhiteSpace($desktopPath)) {
		Write-Host "[lyfmark-install] Desktop folder was not found. Desktop shortcut was not created."
		return
	}

	$shortcutPath = Join-Path $desktopPath "LyfMark - $script:EffectiveProjectName.lnk"
	$shell = New-Object -ComObject WScript.Shell
	$shortcut = $shell.CreateShortcut($shortcutPath)
	$shortcut.TargetPath = $codeExecutable
	$shortcut.Arguments = "`"$workspacePath`""
	$shortcut.WorkingDirectory = $ProjectDirectory
	$shortcut.IconLocation = $codeExecutable
	$shortcut.Save()
	Write-Host "[lyfmark-install] Desktop shortcut created: $shortcutPath"
}

function Open-CustomerWorkspace {
	param([string]$ProjectDirectory)

	if ($SkipVSCode -or $SkipOpenWorkspace) {
		return
	}
	Update-CurrentProcessPath
	$codeExecutable = Get-CodeExecutablePath
	if ([string]::IsNullOrWhiteSpace($codeExecutable)) {
		Write-Host "[lyfmark-install] Visual Studio Code is installed, but the 'code' command is not available yet. Open the project manually after restarting Windows."
		return
	}

	$workspacePath = Get-CustomerWorkspacePath $ProjectDirectory
	if (Test-Path -LiteralPath $workspacePath) {
		Write-Step "Opening LyfMark in Visual Studio Code"
		Start-Process -FilePath $codeExecutable -ArgumentList @($workspacePath) | Out-Null
	}
}

function Test-GitHeadExists {
	param([string]$ProjectDirectory)

	try {
		[void](Invoke-NativeCommandCapture "git" @("-C", $ProjectDirectory, "rev-parse", "--verify", "HEAD") "Check initial Git commit")
		return $true
	} catch {
		return $false
	}
}

function Get-GitStatusPorcelain {
	param([string]$ProjectDirectory)
	return Invoke-NativeCommandCapture "git" @("-C", $ProjectDirectory, "status", "--porcelain") "Check customer Git status"
}

function Ensure-InitialCustomerCommit {
	param([string]$ProjectDirectory)

	$hasHead = Test-GitHeadExists $ProjectDirectory
	$status = Get-GitStatusPorcelain $ProjectDirectory
	if ($hasHead -and [string]::IsNullOrWhiteSpace($status)) {
		Write-Host "[lyfmark-install] Customer Git repository already has an initial commit."
		return
	}

	Write-Step "Creating initial customer Git commit"
	Invoke-NativeCommandQuiet "git" @("-C", $ProjectDirectory, "add", ".") "Stage LyfMark project files"
	$statusAfterAdd = Get-GitStatusPorcelain $ProjectDirectory
	if ([string]::IsNullOrWhiteSpace($statusAfterAdd)) {
		Write-Host "[lyfmark-install] No project changes need to be committed."
		return
	}
	Invoke-NativeCommandQuiet "git" @("-C", $ProjectDirectory, "commit", "-m", "Initial LyfMark website") "Create initial customer commit"
}

function Resolve-GithubRepositoryUrl {
	if (-not [string]::IsNullOrWhiteSpace($GithubRepositoryUrl)) {
		return $GithubRepositoryUrl.Trim()
	}
	if ($Yes) {
		return ""
	}

	Write-Step "Connect customer GitHub repository"
	Write-Host "[lyfmark-install] Create an empty GitHub repository for this website, then paste its repository URL."
	Write-Host "[lyfmark-install] Example: git@github.com:your-name/your-website.git"
	Write-Host "[lyfmark-install] Leave empty to skip the first push for now."
	Start-Process "https://github.com/new" | Out-Null
	$answer = Read-Host "GitHub repository URL"
	return $answer.Trim()
}

function Ensure-GitRemote {
	param(
		[string]$ProjectDirectory,
		[string]$RemoteUrl
	)

	if ([string]::IsNullOrWhiteSpace($RemoteUrl)) {
		Write-Host "[lyfmark-install] GitHub remote setup skipped. The local project is ready and can be connected later."
		return $false
	}

	if ($RemoteUrl -notmatch "^(git@github\.com:.+/.+\.git|https://github\.com/.+/.+\.git)$") {
		throw "GitHub repository URL must look like git@github.com:account/repository.git or https://github.com/account/repository.git."
	}

	$existingRemote = ""
	try {
		$existingRemote = Invoke-NativeCommandCapture "git" @("-C", $ProjectDirectory, "remote", "get-url", "origin") "Read GitHub origin"
	} catch {
		$existingRemote = ""
	}

	if ([string]::IsNullOrWhiteSpace($existingRemote)) {
		Invoke-NativeCommand "git" @("-C", $ProjectDirectory, "remote", "add", "origin", $RemoteUrl) "Set GitHub origin"
	} else {
		Invoke-NativeCommand "git" @("-C", $ProjectDirectory, "remote", "set-url", "origin", $RemoteUrl) "Update GitHub origin"
	}
	return $true
}

function Publish-CustomerRepository {
	param([string]$ProjectDirectory)

	Ensure-InitialCustomerCommit $ProjectDirectory
	$remoteUrl = Resolve-GithubRepositoryUrl
	if (-not (Ensure-GitRemote $ProjectDirectory $remoteUrl)) {
		return
	}

	Write-Step "Pushing initial website to GitHub"
	try {
		Invoke-NativeCommand "git" @("-C", $ProjectDirectory, "push", "-u", "origin", "main") "Push initial customer commit"
	} catch {
		throw "Initial GitHub push failed. Check that the GitHub repository exists, is empty, and that your SSH key is added to your GitHub account. $($_.Exception.Message)"
	}
}

function Pause-IfNeeded {
	if (-not $NoPause) {
		Write-Host ""
		Read-Host "Press Enter to close this window"
	}
}

function Main {
	if (-not (Test-Windows)) {
		throw "This installation script is only supported on Windows."
	}

	Import-InstallInfo

	Write-Host "[lyfmark-install] LyfMark installation started."
	Write-Host "[lyfmark-install] Target folder: $InstallDirectory"
	Write-Host "[lyfmark-install] Core version: $CoreVersion"
	Write-Host "[lyfmark-install] Core package: $(Get-CorePackageUrl)"

	if ($AdminToolInstallOnly) {
		Ensure-RequiredTools
		Write-Host "[lyfmark-install] Required programs are ready."
		return
	}

	$script:EffectiveProjectName = Resolve-ProjectName
	Write-Host "[lyfmark-install] Project name: $script:EffectiveProjectName"

	Invoke-ElevatedToolInstallIfNeeded
	Ensure-RequiredTools
	$projectDirectoryOutput = @(Install-ProjectSources)
	if ($projectDirectoryOutput.Count -ne 1) {
		throw "Internal installer error: project source setup returned unexpected output."
	}
	$projectDirectory = [string]$projectDirectoryOutput[0]
	Invoke-ProjectWizard $projectDirectory
	Publish-CustomerRepository $projectDirectory
	Install-LyfMarkVsCodeExtension $projectDirectory
	New-DesktopWorkspaceShortcut $projectDirectory
	Open-CustomerWorkspace $projectDirectory

	Write-Host ""
	Write-Host "[lyfmark-install] LyfMark is ready."
	Write-Host "[lyfmark-install] Project folder: $projectDirectory"
}

try {
	Main
	Remove-TemporaryBootstrapScript
	Pause-IfNeeded
	exit 0
} catch {
	Write-Host ""
	Write-Host "[lyfmark-install] Error: $($_.Exception.Message)" -ForegroundColor Red
	Remove-TemporaryBootstrapScript
	Pause-IfNeeded
	exit 1
}
