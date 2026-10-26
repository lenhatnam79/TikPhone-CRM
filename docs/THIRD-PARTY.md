# Third-party components

- Electron 45.0.0: MIT. Electron and Chromium license files are included in the desktop distribution.
- Python: Python Software Foundation License. Windows runtime includes its license. The Mac backend bundles Python 3.9.6 from the build environment; the Python license is included under `licenses/`.
- scrcpy 5.0.1, ADB and bundled media libraries: official release packages from [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy/releases/tag/v5.0.1). Their complete license notices remain in the `tools/` directory of each desktop distribution. scrcpy is unmodified.
- PyInstaller: GPL with the distribution exception for generated applications. [License](https://pyinstaller.org/en/stable/license.html).
- certifi: Mozilla Public License 2.0. License included under `licenses/`.
- Playwright, electron-builder and Prettier are development tools and are not shipped as runtime code in the desktop app.

Official runtime source: [Python Windows downloads](https://www.python.org/downloads/windows/). Windows Python runtime is pinned to 3.15.1 in the preparation script. The build source and exact npm dependency versions are recorded in `package-lock.json`.
