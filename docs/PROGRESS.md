# Development checkpoints

## Initial saved implementation

Completed source modules: Electron main/preload boundary; typed application API; real hardware and process providers; reversible registry preference engine; guarded Windows temporary-file/browser-cache/Recycle Bin cleaner; React dashboard and feature pages; backend and browser test sources; Windows packaging configuration and CI workflow.

This checkpoint preserves the interrupted implementation. The React entry point references `src/styles.css`, which has not yet been written. It is not a release build. The next stage is to complete interface styling, run typecheck/build/browser tests, then verify the scanner and cleaner integration and create the Windows package.

Earlier Linux backend run: 62 passed, 4 Windows-only checks skipped. Additional review tests have since been added and need a new run. Windows APIs and the installer have not been validated on Windows. No production-readiness or gaming performance claims are made.

## Stage 1 — working interface

Added the complete responsive purple/black stylesheet, retained existing application logic, corrected packaged logo paths and restoration-history controls, and made navigation scroll reset deterministic.

Validation on Linux: TypeScript and production renderer/Electron build passed; six Playwright browser journeys passed; backend suite passed 78 tests with four native Windows checks skipped. Browser tests use explicitly synthetic adapters only in test code. Runtime screenshots were inspected.

Next: validate native-script syntax and scanner/cleaner desktop integration, then package and verify the Windows artifact.

## Stage 2 — scanner and cleaner integration

Added native PowerShell parsing, C# compilation and Win32 structure-layout checks; corrected the file-disposition Boolean layout and excluded files marked as Windows system files. Added a desktop close guard during cleanup/settings mutations so results are not lost by a normal close action. Added scanner rendering/export, failed-scan and keyboard-confirmation UI coverage.

Validation: 78 backend tests passed, four native Windows checks skipped; nine browser journeys passed; production build passed. The bundled Electron desktop read actual Linux CPU/RAM through the preload bridge and rejected Windows cleanup on Linux. This isolated container smoke used test-only headless/no-sandbox flags; normal application sandbox configuration remains enabled. Five PowerShell scripts parsed and the native C# declarations/Win32 structure sizes compiled and checked without invoking Windows APIs.

Windows hardware/provider behavior, actual cleanup, and install/uninstall remain Windows validation requirements. Next stage: build the unsigned Windows installer and verify its artifact and contents.

## Stage 3 — verified portable checkpoint

Built the unsigned portable Windows x64 executable and verified both archive layers, embedded architecture, bundled files, notices and SHA256. Added a dedicated portable build command and corrected obsolete installer schema metadata. A fresh locked dependency install, production build and backend suite passed again.

The NSIS installer configuration is retained; Linux Wine cannot complete its final uninstaller-generation step. Use the Windows workflow for the native installer build. Real Windows launch, install/uninstall and native behavior remain unverified. See VALIDATION.md for artifact identity and measured results.
