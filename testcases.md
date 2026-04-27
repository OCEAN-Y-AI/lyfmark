# Testcases

Canonical testcase structure is now split for better AI and developer focus:

- Global contracts: [src/lyfmark/testcases/global.md](/home/two/projects/lyfmark/src/lyfmark/testcases/global.md)
- Full index and slicing rule: [src/lyfmark/testcases/index.md](/home/two/projects/lyfmark/src/lyfmark/testcases/index.md)
- Module-specific contracts: `src/lyfmark/modules/<module>/testcases.md`
- Installer contracts: `tools/test-installer.mjs`, `tools/test-installer-e2e.mjs`, `.github/workflows/installer-tests.yml`

Rule of thumb:

- Keep only cross-module/system contracts in global testcase files.
- Keep all module behavior, options, regressions, and rendering specifics inside the corresponding module testcase file.
- Keep installer regressions close to the installer tests; Windows installer tests must guard that `npm` uses the active Node installation (`npm-cli.js`) or an absolute `npm.cmd` fallback and that duplicate `Path`/`PATH` variants are normalized before spawning child processes.
- Installer E2E and manual bootstrap tests must isolate `HOME`/`USERPROFILE` in a temporary directory so test runs cannot alter the developer's real global Git identity or SSH setup.
- Windows PowerShell bootstrap tests must guard that native command output stays visible, cannot pollute installer function return values, and that harmless native `stderr` output does not become a terminating PowerShell error.
- Windows PowerShell bootstrap tests must guard remote scriptblock startup without `$PSCommandPath`; elevated re-entry must use a temporary physical `.ps1` file instead of `-File ""`, which exits with `-196608`.
- Installer tests must guard that `npm install` is a mandatory setup step with visible waiting feedback but no redundant "no input required" hint, that Windows bootstrap suppresses manual VS Code next steps from the project wizard, and that the VS Code extension installer uses the bundled VSIX plus a direct `code.cmd` CLI fallback instead of `Code.exe` or `npx` during customer setup.
