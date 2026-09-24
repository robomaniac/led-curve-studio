# Setup and Arduino programming

[Back to the project README](../README.md) | [Development and publishing](DEVELOPMENT.md)

Use the [live app](https://robomaniac.github.io/led-curve-studio/) for the quickest start. Run a local copy when working offline or editing the project files. Neither option requires an application build; the firmware binaries needed for browser programming are already included.

<details>
<summary>In this guide</summary>

- [Open the live app](#open-the-live-app)
- [Work offline](#work-offline)
- [Run locally on Windows](#run-locally-on-windows)
- [If Chrome displays a profile error](#if-chrome-displays-a-profile-error)
- [Sample and saved designs](#sample-and-saved-designs)
- [Program an Arduino](#program-an-arduino)
- [Nano R4 driver and reset recovery](#nano-r4-driver-and-reset-recovery)
- [If programming fails](#if-programming-fails)

</details>

## Open the live app

1. Open [LED Curve Studio](https://robomaniac.github.io/led-curve-studio/) in your browser. Use **desktop Chrome or Microsoft Edge** if you want to program an Arduino. The live app needs no local terminal or launcher.
2. Confirm the studio, sample photo, and moving playhead appear. The playback button says **Pause** while the preview runs. If the page fails to load, stop and check the address and internet connection.
3. Follow the [quick start](../README.md#use-it) to edit a design, or continue to [Program an Arduino](#program-an-arduino).

## Work offline

This option is for design and export. Browser programming uses the live HTTPS app or the [local launcher](#run-locally-on-windows).

1. While connected to the internet, open the [repository](https://github.com/robomaniac/led-curve-studio), choose **Code > Download ZIP**, then extract it. On Windows, right-click the downloaded ZIP, choose **Extract All...**, and open the extracted folder. Reuse an existing complete checkout if you already have one.
2. Open `index.html` from the extracted folder in your browser. The studio and embedded sample photo should appear, even after disconnecting from the internet. If the file is missing, stop and locate the folder containing `index.html`, `README.md`, and `Start LED Curve Studio.cmd` together.
3. Design and export normally. No package installation, web server, or build is required for this mode.

## Run locally on Windows

Prerequisites: an extracted or cloned project folder, **Windows PowerShell 5.1** (included with Windows), and **Chrome or Edge** for direct Arduino programming. Keep the complete `firmware` folder beside `index.html`. No package installation or application build is needed.

1. Press **Windows+E** to open **File Explorer**, then open the project folder containing `index.html`, `README.md`, and `Start LED Curve Studio.cmd`. If you downloaded a ZIP, extract it first using **Extract All...**. Stop if these files are missing.
2. Double-click **Start LED Curve Studio.cmd**. It starts `serve-studio.ps1` with the required options and opens the browser. Success: the terminal prints **Serving:** or **Reusing:** followed by an address. If a server error appears, stop and resolve it before attempting programming.
3. Keep the **serving terminal** open. The launcher reuses a studio server already running; a second launcher window may close after printing **Reusing:**. In Chrome or Edge, open the printed address, normally `http://localhost:8765/index.html`. Use the printed port if it differs. Confirm **LED Curve Studio** appears. For a Chrome profile warning, use the [Edge workaround](#if-chrome-displays-a-profile-error).
4. If you changed files or the page was already open, press **Ctrl+Shift+R** in the studio tab. This loads the latest local files without restarting the server. The current app header is **v1.5**. If the browser cannot reach the page, check that the serving terminal remains open and the address matches; otherwise repeat step 2.
5. To stop the server, press **Ctrl+C** in its serving terminal. To restart it, double-click **Start LED Curve Studio.cmd** again. After moving the project folder, stop the server from the old location before launching from the new folder so it serves the relocated files.

An existing working server can be reused. Watching the browser preview needs no Arduino connection, upload, Python test, or firmware rebuild. Local edits reach the live website only after [publishing them](DEVELOPMENT.md#update-the-live-site).

### Optional: launch from PowerShell

Use this instead of double-clicking the launcher. Open **Windows PowerShell** and run these commands in the **same window**. At the prompt, open the project folder in File Explorer, press **Alt+D**, then **Ctrl+C**, and paste the copied path.

```powershell
$studioRoot = Read-Host 'Paste the project folder path from File Explorer (the folder containing index.html)'
Set-Location -LiteralPath $studioRoot -ErrorAction Stop
& '.\Start LED Curve Studio.cmd'
```

Success: **Serving:** or **Reusing:** and the studio opens. Keep the original serving terminal open. Stop if changing folders or starting the server fails.

### Optional: start without opening a browser

Open **Windows PowerShell** and run this alternative in the **same window**. Supply the project folder path as described above; this block defines its own variable, so it also works in a new window.

```powershell
$studioRoot = Read-Host 'Paste the project folder path from File Explorer (the folder containing index.html)'
Set-Location -LiteralPath $studioRoot -ErrorAction Stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\serve-studio.ps1' -NoOpen
```

Success: the terminal prints **Serving:** or **Reusing:**. Open that full address in Chrome or Edge when ready and keep the serving terminal open. Stop if an error appears. No separate script installation is needed.

## If Chrome displays a profile error

The launcher opens Chrome first when it is installed. **Profile error occurred** concerns Chrome's saved preferences; launching through PowerShell opens the same profile and does not fix that warning.

1. Click **OK** on Chrome's warning. Keep the existing studio serving terminal open; no server restart is needed if it already printed **Serving:** or **Reusing:**.
2. Open **Windows Start**, type **Microsoft Edge**, and open it. Paste the full studio address printed by the terminal into Edge's address bar, normally `http://localhost:8765/index.html`.
3. Confirm the studio loads. Edge has separate saved designs and device permissions: choose **Import** to restore a previously downloaded project, and select the board in Edge's USB/serial picker when programming. If the page fails to load, stop and check the server and printed address.

This lets you continue using the studio; it does not repair or reset Chrome preferences.

## Sample and saved designs

The bundled photo, `images/AI_esp32_assistant_unlit.png`, is embedded in the HTML for offline use. Its aligned, pill-shaped overlay uses a translucent core, gentle spill, no bright outline, and a default glow spread of 0.75x. The original supplied photo is preserved. See [image assets and edit details](../images/README.md).

1. To retain the design currently open, choose **Download project** before restoring the sample. That file includes its photo.
2. Below the photo, click **Use sample**, beside **Edit LED**. This restores the sample photo, aligned LED, cyan blue (`#20cfff`), and a custom double pulse repeating every **1.70 seconds**, with **Smooth** and **Link ends** on. It also starts playback and exits LED editing.
3. Confirm the photo shows the white ESP32 enclosure and a cyan LED pulsing twice per cycle. **Pause** means playback is running; click it to stop. No preset is highlighted because the sample curve is custom. Drag the orange playhead to inspect a moment in the cycle.

Updates preserve edited curves and custom photos. If a custom photo remains after refreshing, use the steps above to load the bundled sample. The preview starts playing automatically when the page opens. In LED edit mode, arrow keys nudge the LED; selected curve points can be edited with the arrow keys and **Delete**.

Settings save automatically in browser storage. Uploaded images are resized to a maximum **1600 px edge** and stored locally in **IndexedDB**. All animation processing stays in the browser. Saved designs and device permissions belong to the browser and site address you used; use **Download project** and **Import** when moving a design between them. Export choices are described in [Saving and sharing](../README.md#saving-and-sharing).

## Program an Arduino

**Browser flashing is experimental.** Automated tests exercise simulated USB/serial devices and app behavior. Repeatable uploads on physical boards have not yet been confirmed for this release. Drivers, permissions, bootloader state, and board variants can affect uploading. AVR uploads include readback verification; Nano R4 uploads do not. A successful simulated test or a video of a blinking board does not establish reliable browser flashing.

Prerequisites: **desktop Chrome or Edge**, a supported board connected by a USB data cable, and either the live HTTPS app or the local launcher. Opening `index.html` directly from disk is for design and export. Programming **overwrites the board's current sketch**.

| Board profile | Browser upload method |
| --- | --- |
| Arduino Nano R4 | WebUSB DFU; double-tap Reset if the Upgrade device is absent. |
| Arduino Uno R3 / ATmega328P | Web Serial STK500v1 at 115200 baud. |
| Classic Nano / ATmega328P | Web Serial STK500v1: new bootloader at 115200 baud, old bootloader at 57600 baud. |

1. Open the [live app](https://robomaniac.github.io/led-curve-studio/) in Chrome or Edge, or follow [Run locally on Windows](#run-locally-on-windows). Confirm the studio loads before continuing. For a local copy, keep the existing serving terminal open; launching again reuses the server.
2. Finish your curve, then click **Arduino code**. Select the correct **Board** profile and **LED output**. **Built-in LED (no wiring)** uses the board's LED. For **External LED (D9 - hardware PWM)**, follow the wiring shown in the app: D9 to a 220-330 ohm resistor, then LED anode (+); LED cathode (-) to GND.
3. Close Arduino IDE's Serial Monitor and any other application or browser tab using the board. Click the **Program** button for the selected board and select its USB device/port. The app downloads and validates the firmware before resetting or writing the board.
4. **Nano R4 only:** if asked for bootloader access, click **Program Nano R4** again and select **Nano R4 (Upgrade)**. If Upgrade is absent, cancel the picker, double-tap the board's **RESET** button, then click **Program Nano R4** again. The runtime interface and bootloader need separate permission. Permission granted to localhost does not carry over to the hosted site.
5. Wait for completion. Uno/classic Nano reports **Programmed and verified** after reading every page back. Nano R4 reports that it accepted the firmware and restarted; this uploader does not read back Nano R4 flash. Confirm the **physical LED plays your selected pattern**. If an error appears, stop and follow [If programming fails](#if-programming-fails) before retrying.

The built-in Nano R4 LED is `LED_BUILTIN` on internal pin 22, not D13. Uno/classic Nano uses D13. These outputs use non-blocking software PWM; D9 uses hardware PWM. Browser uploading patches a copy of the bundled player with the selected duration, output mode, pin, and 64 gamma-corrected samples. It validates firmware length, configuration, and SHA-256 first, and locks board/output controls during programming. No browser C++ compiler or cloud service is involved; firmware comes from the same site or local server.

Mega 2560, Leonardo/Micro, Nano Every, Uno R4 WiFi, SAMD/MKR, and ESP32 require other bootloader protocols and do not have direct-programming profiles here. Sketch export remains available for use with the appropriate board toolchain. For source changes, see the [optional firmware rebuild guide](../firmware/README.md); normal use needs no compiler or rebuild.

## Nano R4 driver and reset recovery

### Install the driver only if it is missing

Windows needs Arduino's WinUSB driver for both the Nano R4 runtime firmware-upgrade interface and its bootloader. A working COM port confirms only the separate serial interface. **Device Manager code 28** on `DFU-RT Port` means its driver is missing; see [Microsoft's explanation](https://learn.microsoft.com/en-us/windows-hardware/drivers/install/cm-prob-failed-install). The [official Arduino driver](https://github.com/arduino/ArduinoCore-renesas/blob/main/drivers/renesas.inf) covers both Nano R4 USB modes.

Reuse an existing working driver. Follow these steps only if the firmware-upgrade interface has a warning or programming cannot open it. Installation requires an internet connection and Windows administrator approval.

1. Open **Arduino IDE 2 > Tools > Board > Boards Manager**. Search for **Arduino UNO R4 Boards** by **Arduino**. This package also includes Nano R4 support. Choose **1.5.3 or later**, click **Install**, and approve Arduino's driver installer when Windows asks. Stop if installation fails.
2. Disconnect and reconnect the board. Right-click **Windows Start > Device Manager**, locate its upgrade interface (`DFU-RT Port`, `Nano R4 Firmware Upgrade`, or a Nano R4 DFU/Upgrade entry), then open **Properties > General**. Success: no warning icon and the status says the device is working properly. If code 28 remains, stop: installation is incomplete. Follow [Arduino's missing-driver recovery instructions](https://support.arduino.cc/hc/en-us/articles/11011849739804-dfu-util-errors-when-uploading-exit-status-74).
3. Close Arduino IDE/Serial Monitor, return to the studio in Chrome or Edge, and press **Ctrl+Shift+R**. Confirm **v1.4 or later** appears; the current release is v1.5. Open **Arduino code**, select **Arduino Nano R4**, click **Program Nano R4**, and select the board. If asked for Upgrade access, follow the recovery steps below.

Installing a driver does not compile or flash the player. The next programming attempt uses the bundled binary; no firmware rebuild is required.

### Recover a stalled automatic reset

The complete automatic Nano R4 reset attempt is limited to **8 seconds**, including USB open, interface claim, descriptor reads, reset, release, and bootloader discovery. On timeout the app restores controls, reports the stalled step, and closes late USB results; an expired attempt cannot continue resetting or flashing. A timed-out runtime handle is not reused.

1. In the existing studio tab, press **Ctrl+Shift+R** and confirm **v1.4 or later**. This loads the corrected code and clears a stalled browser request. The live site needs no terminal. For a local copy, reuse the serving terminal; if it is closed, double-click **Start LED Curve Studio.cmd** first.
2. If the board is already listed as **Nano R4 (Upgrade)** or **Nano R4 DFU**, continue to step 3. Otherwise press **RESET** twice quickly to enter the bootloader, following [Arduino's manual recovery](https://support.arduino.cc/hc/en-us/articles/11011849739804-dfu-util-errors-when-uploading-exit-status-74).
3. Open **Arduino code**, select **Arduino Nano R4** and the intended output, then click **Program Nano R4**. In the USB picker select **Nano R4 (Upgrade)**. If absent, cancel and check the [driver installation](#install-the-driver-only-if-it-is-missing) before retrying.
4. Wait for completion and confirm the physical LED plays the pattern. If programming stops on an error, retain its exact wording; a passing automated test does not replace this hardware check.

## If programming fails

| Visible symptom | Meaning and next action |
| --- | --- |
| Stuck at Switching Nano R4 into DFU mode | Press **Ctrl+Shift+R** to load v1.4 or later, check for a missing DFU-RT driver (Windows code 28), then follow [reset recovery](#recover-a-stalled-automatic-reset). |
| Nano R4 asks to select Upgrade | Runtime and bootloader interfaces need separate USB permission. Click **Program Nano R4** again and select **Nano R4 (Upgrade)**. If absent, cancel, double-tap **RESET**, and retry. |
| Firmware is missing, outdated, or does not match | Press **Ctrl+Shift+R**. Locally, keep the serving terminal open. For a published site, [deploy `index.html` and both `.bin` files together](DEVELOPMENT.md#update-the-live-site). The app has not reset or written the board at this point. |
| Could not synchronize with ATmega328P | Confirm the exact Uno/classic Nano profile, including **old bootloader** when applicable. Close Serial Monitor and other tabs using the port, then retry. |
| Cannot open or claim the USB device/port | Close Arduino IDE/Serial Monitor and other tabs using it, reconnect the board, and retry. If it persists, retain the exact error and browser/board model for diagnosis. |
| Firmware written, but Nano R4 did not restart | Press **RESET** once, then check the LED pattern. |

The Nano R4 reconnect matches the selected board's serial number. Missing bootloader permission produces a second-click instruction, following the [WebUSB permission model](https://wicg.github.io/webusb/#permissions). Uno/classic Nano downloads firmware before resetting into its short bootloader window, consistent with [Arduino's Optiboot implementation](https://github.com/arduino/ArduinoCore-avr/blob/master/bootloaders/optiboot/optiboot.c).

The eight-second limit covers automatic reset. Later bootloader transfers still depend on the native USB driver; if a device stops responding during writing, unplug and reconnect it before retrying. A physical flash remains a required release check. See [Development and publishing](DEVELOPMENT.md) for regression tests and checkout verification.
