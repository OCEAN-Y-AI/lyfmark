# Testcases

Canonical testcase structure is now split for better AI and developer focus:

- Global contracts: [src/lyfmark/testcases/global.md](/home/two/projects/lyfmark/src/lyfmark/testcases/global.md)
- Full index and slicing rule: [src/lyfmark/testcases/index.md](/home/two/projects/lyfmark/src/lyfmark/testcases/index.md)
- Module-specific contracts: `src/lyfmark/modules/<module>/testcases.md`

Rule of thumb:

- Keep only cross-module/system contracts in global testcase files.
- Keep all module behavior, options, regressions, and rendering specifics inside the corresponding module testcase file.
