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
