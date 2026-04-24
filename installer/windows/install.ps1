#requires -Version 5.1

[CmdletBinding()]
param(
	[string]$RepositoryUrl = "https://github.com/OCEAN-Y-AI/lyfmark.git",
	[string]$InstallDirectory = (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "LyfMark"),
	[string]$ProjectName = "",
	[switch]$Yes,
	[string]$GitName = "",
	[string]$GitEmail = "",
	[string]$SshComment = "",
	[switch]$SkipToolInstall,
	[switch]$SkipVSCode,
	[switch]$SkipOpenWorkspace,
	[switch]$NoPause
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp.com 65001 | Out-Null
$script:EffectiveProjectName = ""

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

function Invoke-NativeCommand {
	param(
		[string]$Command,
		[string[]]$Arguments,
		[string]$Label,
		[string]$WorkingDirectory = ""
	)

	Write-Host "[lyfmark-install] $Label"
	if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) {
		& $Command @Arguments
	} else {
		Push-Location $WorkingDirectory
		try {
			& $Command @Arguments
		} finally {
			Pop-Location
		}
	}

	if ($LASTEXITCODE -ne 0) {
		throw "$Label failed with exit code $LASTEXITCODE."
	}
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
	param([string]$ResolvedProjectName)

	$arguments = @(
		"-NoProfile",
		"-ExecutionPolicy", "Bypass",
		"-File", "`"$PSCommandPath`"",
		"-RepositoryUrl", "`"$RepositoryUrl`"",
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
	if ($SkipVSCode) {
		$arguments += "-SkipVSCode"
	}
	if ($SkipOpenWorkspace) {
		$arguments += "-SkipOpenWorkspace"
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
	if (-not (Test-CommandAvailable "ssh-keygen")) {
		return $true
	}
	if (-not $SkipVSCode -and -not (Test-CommandAvailable "code")) {
		return $true
	}
	return $false
}

function Restart-ElevatedIfNeeded {
	if ($SkipToolInstall -or (Test-Administrator) -or -not (Test-ToolInstallNeeded)) {
		return
	}

	Write-Step "Requesting administrator permission"
	Write-Host "[lyfmark-install] Windows may ask for permission once so LyfMark can install required programs."
	$argumentList = ConvertTo-ArgumentList $script:EffectiveProjectName
	$process = Start-Process -FilePath "powershell.exe" -ArgumentList $argumentList -Verb RunAs -Wait -PassThru
	exit $process.ExitCode
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
		"--silent"
	) "winget install $PackageId"

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
	if (-not (Test-CommandAvailable "ssh-keygen")) {
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

function Install-ProjectSources {
	$projectDirectory = Get-ProjectDirectory
	$packageJsonPath = Join-Path $projectDirectory "package.json"

	if (Test-Path -LiteralPath $packageJsonPath) {
		Write-Host "[lyfmark-install] Existing LyfMark project found: $projectDirectory"
		if (Test-Path -LiteralPath (Join-Path $projectDirectory ".git")) {
			Invoke-NativeCommand "git" @("-C", $projectDirectory, "pull", "--ff-only") "Update existing LyfMark project"
		}
		return $projectDirectory
	}

	if (Test-Path -LiteralPath $projectDirectory) {
		$existingEntries = @(Get-ChildItem -LiteralPath $projectDirectory -Force)
		if ($existingEntries.Count -gt 0) {
			throw "The target folder already exists but is not a LyfMark project: $projectDirectory"
		}
	}

	Write-Step "Downloading LyfMark project"
	Invoke-NativeCommand "git" @("clone", "--depth", "1", $RepositoryUrl, $projectDirectory) "Download LyfMark from GitHub"
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
		$env:LYFMARK_INSTALLER_DEFAULT_GIT_NAME = $GitName
		$env:LYFMARK_INSTALLER_DEFAULT_GIT_EMAIL = $GitEmail
		if (-not [string]::IsNullOrWhiteSpace($SshComment)) {
			$env:LYFMARK_INSTALLER_DEFAULT_SSH_COMMENT = $SshComment
		}
		$wizardArguments += "--yes"
	}

	Invoke-NativeCommand "node" $wizardArguments "Run LyfMark installer" $ProjectDirectory
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
	Invoke-NativeCommand "node" @($installerPath) "Install LyfMark VS Code extension" $ProjectDirectory
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

	Write-Host "[lyfmark-install] LyfMark installation started."
	Write-Host "[lyfmark-install] Target folder: $InstallDirectory"
	Write-Host "[lyfmark-install] Source: $RepositoryUrl"

	$script:EffectiveProjectName = Resolve-ProjectName
	Write-Host "[lyfmark-install] Project name: $script:EffectiveProjectName"

	Restart-ElevatedIfNeeded
	Ensure-RequiredTools
	$projectDirectory = Install-ProjectSources
	Invoke-ProjectWizard $projectDirectory
	Install-LyfMarkVsCodeExtension $projectDirectory
	New-DesktopWorkspaceShortcut $projectDirectory
	Open-CustomerWorkspace $projectDirectory

	Write-Host ""
	Write-Host "[lyfmark-install] LyfMark is ready."
	Write-Host "[lyfmark-install] Project folder: $projectDirectory"
}

try {
	Main
	Pause-IfNeeded
	exit 0
} catch {
	Write-Host ""
	Write-Host "[lyfmark-install] Error: $($_.Exception.Message)" -ForegroundColor Red
	Pause-IfNeeded
	exit 1
}
