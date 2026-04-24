#requires -Version 5.1

[CmdletBinding()]
param(
	[string]$RepositoryUrl = "https://github.com/OCEAN-Y-AI/lyfmark.git",
	[string]$InstallDirectory = (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "LyfMark"),
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

function Write-Step {
	param([string]$Message)
	Write-Host ""
	Write-Host "[lyfmark-install] $Message"
}

function Test-Windows {
	return [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
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
		throw "$Label ist mit Fehlercode $LASTEXITCODE fehlgeschlagen."
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
		Write-Host "[lyfmark-install] $DisplayName ist bereits verfügbar."
		return
	}

	if ($SkipToolInstall) {
		throw "$DisplayName fehlt und die automatische Tool-Installation ist deaktiviert."
	}

	if (-not (Test-CommandAvailable "winget")) {
		throw "winget wurde nicht gefunden. Installiere Microsoft App Installer und starte LyfMark danach erneut."
	}

	Write-Step "$DisplayName installieren"
	Invoke-NativeCommand "winget" @(
		"install",
		"--id", $PackageId,
		"--exact",
		"--source", "winget",
		"--accept-package-agreements",
		"--accept-source-agreements"
	) "winget install $PackageId"

	Update-CurrentProcessPath
	if (-not (Test-CommandAvailable $ProbeCommand)) {
		throw "$DisplayName wurde installiert, ist aber in diesem Prozess noch nicht verfügbar. Starte Windows neu und führe LyfMark erneut aus."
	}
}

function Ensure-RequiredTools {
	Write-Step "Benötigte Programme prüfen"
	Update-CurrentProcessPath

	Install-WingetPackage "Git.Git" "Git" "git"
	Install-WingetPackage "OpenJS.NodeJS.LTS" "Node.js LTS" "node"

	Update-CurrentProcessPath
	if (-not (Test-CommandAvailable "npm")) {
		throw "npm fehlt, obwohl Node.js verfügbar ist. Installiere Node.js LTS neu und starte LyfMark danach erneut."
	}
	if (-not (Test-CommandAvailable "ssh-keygen")) {
		throw "ssh-keygen fehlt. Installiere Git für Windows neu und starte LyfMark danach erneut."
	}

	if (-not $SkipVSCode) {
		Install-WingetPackage "Microsoft.VisualStudioCode" "Visual Studio Code" "code"
	}
}

function Get-ProjectDirectory {
	New-Item -ItemType Directory -Force -Path $InstallDirectory | Out-Null
	return Join-Path $InstallDirectory "lyfmark"
}

function Install-ProjectSources {
	$projectDirectory = Get-ProjectDirectory
	$packageJsonPath = Join-Path $projectDirectory "package.json"

	if (Test-Path -LiteralPath $packageJsonPath) {
		Write-Host "[lyfmark-install] Bestehendes LyfMark-Projekt gefunden: $projectDirectory"
		return $projectDirectory
	}

	if (Test-Path -LiteralPath $projectDirectory) {
		$existingEntries = @(Get-ChildItem -LiteralPath $projectDirectory -Force)
		if ($existingEntries.Count -gt 0) {
			throw "Der Zielordner existiert bereits, ist aber kein LyfMark-Projekt: $projectDirectory"
		}
	}

	Write-Step "LyfMark-Projekt laden"
	Invoke-NativeCommand "git" @("clone", "--depth", "1", $RepositoryUrl, $projectDirectory) "LyfMark von GitHub laden"
	return $projectDirectory
}

function Invoke-ProjectWizard {
	param([string]$ProjectDirectory)

	Write-Step "LyfMark-Projekt einrichten"
	$wizardArguments = @("tools\installer\wizard.mjs")
	if ($Yes) {
		if ([string]::IsNullOrWhiteSpace($GitName) -or [string]::IsNullOrWhiteSpace($GitEmail)) {
			throw "-Yes benötigt -GitName und -GitEmail."
		}
		$env:LYFMARK_INSTALLER_DEFAULT_GIT_NAME = $GitName
		$env:LYFMARK_INSTALLER_DEFAULT_GIT_EMAIL = $GitEmail
		if (-not [string]::IsNullOrWhiteSpace($SshComment)) {
			$env:LYFMARK_INSTALLER_DEFAULT_SSH_COMMENT = $SshComment
		}
		$wizardArguments += "--yes"
	}

	Invoke-NativeCommand "node" $wizardArguments "LyfMark Installer ausführen" $ProjectDirectory
}

function Open-CustomerWorkspace {
	param([string]$ProjectDirectory)

	if ($SkipOpenWorkspace) {
		return
	}
	Update-CurrentProcessPath
	if (-not (Test-CommandAvailable "code")) {
		Write-Host "[lyfmark-install] Visual Studio Code ist installiert, der Befehl 'code' ist aber noch nicht verfügbar. Öffne das Projekt nach einem Neustart manuell."
		return
	}

	$workspacePath = Join-Path $ProjectDirectory ".vscode\lyfmark.customer.code-workspace"
	if (Test-Path -LiteralPath $workspacePath) {
		Write-Step "LyfMark in Visual Studio Code öffnen"
		Start-Process -FilePath "code" -ArgumentList @($workspacePath) | Out-Null
	}
}

function Pause-IfNeeded {
	if (-not $NoPause) {
		Write-Host ""
		Read-Host "Enter drücken, um dieses Fenster zu schließen"
	}
}

function Main {
	if (-not (Test-Windows)) {
		throw "Dieses Installationsskript ist nur für Windows vorgesehen."
	}

	Write-Host "[lyfmark-install] LyfMark Installation gestartet."
	Write-Host "[lyfmark-install] Zielordner: $InstallDirectory"
	Write-Host "[lyfmark-install] Quelle: $RepositoryUrl"

	Ensure-RequiredTools
	$projectDirectory = Install-ProjectSources
	Invoke-ProjectWizard $projectDirectory
	Open-CustomerWorkspace $projectDirectory

	Write-Host ""
	Write-Host "[lyfmark-install] LyfMark ist fertig eingerichtet."
	Write-Host "[lyfmark-install] Projektordner: $projectDirectory"
}

try {
	Main
	Pause-IfNeeded
	exit 0
} catch {
	Write-Host ""
	Write-Host "[lyfmark-install] Fehler: $($_.Exception.Message)" -ForegroundColor Red
	Pause-IfNeeded
	exit 1
}
