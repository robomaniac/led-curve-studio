# Development and publishing

[Back to the project README](../README.md) | [Setup and Arduino programming](SETUP.md)

LED Curve Studio is a static site with no application build step or runtime dependencies. The packaged firmware is ready for browser programming; rebuild it only when changing firmware source or checking reproducibility.

- [Verify a checkout](#verify-a-checkout)
- [Upload regression tests](#upload-regression-tests)
- [Firmware changes](#firmware-changes)
- [Update the live site](#update-the-live-site)
- [Repository contents](#repository-contents)

## Verify a checkout

Prerequisites: Windows PowerShell 5.1 (included with Windows), Chrome or Edge, and an extracted or cloned project folder containing `index.html`. No application build or Arduino connection is needed.

1. Start the server using [Run locally on Windows](SETUP.md#run-locally-on-windows). Reuse the existing server if it is already serving this checkout. Open a **second Windows PowerShell window**, leave the server window running, and run the following commands together. These HTTP checks can run from any folder in that second window. If the server printed a port other than `8765`, change `$studioBase` to that port first.

   ```powershell
   $studioBase = 'http://localhost:8765'
   $paths = @(
       '/__studio_health',
       '/index.html',
       '/images/AI_esp32_assistant_unlit.png',
       '/firmware/nano-r4-player/nano-r4-player.bin',
       '/firmware/atmega328p-player/atmega328p-player.bin'
   )
   foreach ($path in $paths) {
       $response = Invoke-WebRequest -UseBasicParsing -Uri ($studioBase + $path) -ErrorAction Stop
       if ($response.StatusCode -ne 200 -or $response.RawContentLength -eq 0) {
           throw "Missing or empty resource: $path"
       }
       Write-Host "PASS $path"
   }
   ```

   Success: five `PASS` lines. Stop if a request fails; confirm the printed server address and that the `firmware` folder is beside `index.html`.

2. In Chrome or Edge, open the printed server address, change a curve point, and confirm the LED preview updates. Choose **Download project**, then **Import** the downloaded file and confirm the curve and image return. This checks operation without overwriting a board's sketch.

3. When finished, press **Ctrl+C** in the serving terminal and close the test window. No build or test artifacts need cleanup.

## Upload regression tests

No board is needed for these automated checks.

Prerequisites: **Python 3** and installed **Google Chrome or Microsoft Edge**. No Python packages or Node.js are needed. The tests use simulated USB/serial devices and an isolated browser profile; they do not open a real board or replace your browser session.

1. Open **Windows PowerShell**, then run these commands in the same window. When prompted for the project folder, open that folder in File Explorer, press **Alt+D**, then **Ctrl+C**, and paste the copied path into PowerShell:

   ```powershell
   $studioRoot = Read-Host 'Paste the project folder path from File Explorer (the folder containing index.html)'
   Set-Location -LiteralPath $studioRoot -ErrorAction Stop
   python tests/run_upload_tests.py
   ```

   Success: every check prints `PASS` and the last line reports zero failures. The runner starts and stops its own local server, headless browser, and temporary profile. It needs no manual cleanup. Stop if any check fails; do not publish a failing upload change.

2. **Only if the browser is not found automatically**, run this complete command in the same PowerShell window and project folder instead, using Chrome's standard installation path:

   ```powershell
   python tests/run_upload_tests.py --browser 'C:\Program Files\Google\Chrome\Application\chrome.exe'
   ```

   If Chrome is installed elsewhere, replace that path with the installed `chrome.exe` or `msedge.exe` path. This reruns the same tests with an explicitly selected browser.

3. After all tests pass, follow [Program an Arduino](SETUP.md#program-an-arduino) on the actual board. Programming replaces its current sketch. The automated checks exercise firmware validation, USB permissions, failure cleanup, AVR readback, and app startup; they cannot prove physical USB-driver behavior or that a real LED plays correctly.

## Firmware changes

For changes to the Uno/classic Nano player, follow the [optional firmware rebuild guide](../firmware/README.md). It contains the required toolchain versions, complete build and validation commands, browser metadata updates, and temporary-build cleanup. Editing an `.ino` alone does not update the binary the browser uploads.

The Nano R4 binary is retained as supplied; a reproducible rebuild has not been verified. Do not use the AVR build commands or binary for that board. Normal app use, a local folder move, or a README change requires no firmware rebuild or board upload.

Browser flashing remains **experimental**. Automated checks use simulated devices and cannot establish reliable uploads on physical hardware. AVR uploads include readback verification; Nano R4 uploads do not. After an uploader or firmware change, complete the [regression tests and physical-board check](#upload-regression-tests) before publishing.

## Update the live site

GitHub Pages serves the root folder of the `main` branch in [robomaniac/led-curve-studio](https://github.com/robomaniac/led-curve-studio). Its repository setting is **Settings > Pages > Build and deployment > Source: Deploy from a branch**, with **Branch: main** and **/(root)**. The root `.nojekyll` file lets Pages serve these static files without Jekyll processing. Each push to `main` starts a Pages deployment. Publish `index.html` and both firmware `.bin` files together when changing the uploader.

Prerequisites: a local clone of this repository open in VS Code, Git installed, and a GitHub account with write access to `robomaniac/led-curve-studio`. Reuse an existing signed-in Git session. If you are using an extracted ZIP rather than a clone, in VS Code choose **View > Command Palette > Git: Clone**, enter `https://github.com/robomaniac/led-curve-studio.git`, choose a local parent folder, and open the clone when prompted. Make the reviewed changes in that clone before continuing. Stop if cloning or GitHub sign-in fails.

1. Commit and push the reviewed changes to `main` using your Git client. In VS Code, open the repository folder, choose **Source Control**, review and stage the intended files with **+**, enter a commit message, choose **Commit**, then choose **Sync Changes**. Confirm the push completes; stop if Git reports an error. For uploader changes, complete the [upload regression tests](#upload-regression-tests) and their physical-board check before pushing.
2. Open the repository's **[Actions tab](https://github.com/robomaniac/led-curve-studio/actions)** and select the latest **pages build and deployment** run. Wait for it to finish with a green check. If it fails, open the failed job's log and resolve the error before treating the update as published.
3. Open **[LED Curve Studio](https://robomaniac.github.io/led-curve-studio/)**. If its tab was already open, press **Ctrl+Shift+R** after the deployment succeeds to load the new files. Confirm your change appears and the preview plays. No local server restart is required.

## Repository contents

Publish this folder's contents as the repository root. Keep the following files and folders together:

| Path | Purpose |
| --- | --- |
| `index.html` | Complete browser app, including its offline sample image. |
| `README.md` | Project overview, quick start, and examples. |
| `docs/` | Detailed setup, troubleshooting, testing, and publishing guides. |
| `images/` | Sample photos, screenshots, GIFs, and image documentation. |
| `Start LED Curve Studio.cmd` | Windows launcher. |
| `serve-studio.ps1` | Local server used by the launcher. |
| `firmware/` | Player sources, required binaries, and optional rebuild guide. |
| `tests/` | Browser and simulated USB/serial regression checks. |
| `.gitignore` | Local files excluded from version control. |
| `.nojekyll` | Tells GitHub Pages to serve the static files without Jekyll. |

The `.ino` files are firmware source. The `.bin` files are required by direct browser programming; do not exclude them as disposable build output. Moving files locally does not upload them to GitHub or deploy GitHub Pages.
