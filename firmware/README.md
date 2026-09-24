# Player firmware

The browser uploads the `.bin` files; the `.ino` files are their source. Keep both in the repository. Editing an `.ino` alone does not change browser programming.

The AVR player uses 32-bit interpolation arithmetic so sharp brightness transitions do not overflow the ATmega328P's 16-bit `int`. The Nano R4 already evaluates this arithmetic with 32-bit `int`; its source and binary were unchanged by this fix.

## Optional: rebuild the Uno / classic Nano player on Windows

Normal application use does not need a compiler or rebuild. Follow these steps only after changing the AVR firmware or when checking its reproducibility. These commands compile files; they do not connect to or flash a board.

Prerequisites: Windows PowerShell, Arduino IDE 2 installed in its default per-user location, and Arduino AVR Boards **1.8.8**. The checked-in AVR binary was built with Arduino CLI **1.4.1**, AVR Boards **1.8.8**, and **avr-gcc 7.3.0-atmel3.6.1-arduino7**, using board identifier `arduino:avr:uno`. That firmware also supports the listed classic Nano profiles; their bootloader baud rates differ.

1. Open **Windows PowerShell**. Run every command below in the same window. When prompted, open the project folder containing `index.html` in File Explorer, press **Alt+D**, then **Ctrl+C**, and paste that path into PowerShell.

   ```powershell
   $studioRoot = Read-Host 'Paste the project folder path from File Explorer (the folder containing index.html)'
   Set-Location -LiteralPath $studioRoot -ErrorAction Stop
   $studioArduinoCli = Join-Path $env:LOCALAPPDATA 'Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
   $studioAvrObjcopy = Join-Path $env:LOCALAPPDATA 'Arduino15\packages\arduino\tools\avr-gcc\7.3.0-atmel3.6.1-arduino7\bin\avr-objcopy.exe'
   if (-not (Test-Path -LiteralPath $studioArduinoCli)) {
       throw 'Arduino CLI was not found. Install Arduino IDE 2 or set $studioArduinoCli to its executable.'
   }
   & $studioArduinoCli version
   & $studioArduinoCli core list
   ```

   Success: the commands print the CLI version and installed cores. Reuse the installed AVR core when its version is `1.8.8`. Stop if the CLI cannot run. **Only if the AVR core is missing or has another version**, run these commands with an internet connection, then run `core list` again:

   ```powershell
   & $studioArduinoCli core update-index
   if ($LASTEXITCODE -ne 0) { throw 'Arduino package index update failed' }
   & $studioArduinoCli core install arduino:avr@1.8.8
   if ($LASTEXITCODE -ne 0) { throw 'Arduino AVR Boards installation failed' }
   & $studioArduinoCli core list
   ```

2. Build in a new temporary directory, then convert the ELF to a raw application binary. This deliberately excludes EEPROM and the bootloader.

   ```powershell
   if (-not (Test-Path -LiteralPath $studioAvrObjcopy)) {
       throw 'The expected AVR compiler tools are missing; complete step 1 first.'
   }
   $studioFirmwareBuild = Join-Path ([IO.Path]::GetTempPath()) ('led-curve-avr-build-' + [guid]::NewGuid().ToString('N'))
   New-Item -ItemType Directory -Path $studioFirmwareBuild -ErrorAction Stop | Out-Null
   & $studioArduinoCli compile --fqbn arduino:avr:uno --build-path $studioFirmwareBuild --warnings all '.\firmware\atmega328p-player'
   if ($LASTEXITCODE -ne 0) { throw 'AVR compilation failed; do not replace the packaged binary.' }
   $studioNewBinary = Join-Path $studioFirmwareBuild 'atmega328p-player.bin'
   & $studioAvrObjcopy -O binary -R .eeprom (Join-Path $studioFirmwareBuild 'atmega328p-player.ino.elf') $studioNewBinary
   if ($LASTEXITCODE -ne 0) { throw 'Binary conversion failed; do not replace the packaged binary.' }
   ```

   Success: the compiler reports flash/RAM usage and exits successfully. The current source uses **1,730 bytes of flash** and **109 bytes of RAM**. `--warnings all` may report unused-parameter warnings in Arduino core `new.cpp`; these are unrelated to the player. Stop on a compilation/conversion error.

3. Validate the configuration marker and application size before replacing the packaged binary.

   ```powershell
   $studioBinaryBytes = [IO.File]::ReadAllBytes($studioNewBinary)
   $studioBinaryText = [Text.Encoding]::ASCII.GetString($studioBinaryBytes)
   $studioMarker = 'LEDCRV-AT328P-V1'
   $studioMarkerOffset = $studioBinaryText.IndexOf($studioMarker, [StringComparison]::Ordinal)
   if ($studioMarkerOffset -lt 0 -or $studioMarkerOffset -ne $studioBinaryText.LastIndexOf($studioMarker, [StringComparison]::Ordinal)) {
       throw 'Expected exactly one player configuration marker.'
   }
   if ($studioMarkerOffset + 88 -gt $studioBinaryBytes.Length -or $studioBinaryBytes.Length -gt 30720) {
       throw 'Invalid configuration bounds or firmware exceeds the classic Nano application limit.'
   }
   $studioNewHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $studioNewBinary).Hash.ToLowerInvariant()
   Write-Host ('firmwareBytes: ' + $studioBinaryBytes.Length)
   Write-Host ('firmwareSha256: ' + $studioNewHash)
   Copy-Item -LiteralPath $studioNewBinary -Destination '.\firmware\atmega328p-player\atmega328p-player.bin' -Force -ErrorAction Stop
   ```

   Success: a byte count and SHA-256 hash print, and the checked binary replaces the packaged AVR player. With unchanged source and the listed toolchain, the current hash is `6dc95498fee9e534e73d29160509ecba3383400f37603c8a4cbdc6d5192a38c8`.

4. Open **`index.html` in your editor** and find `ARDUINO_BOARD_PROFILES`. Update `firmwareBytes` and `firmwareSha256` to the values printed in step 3 for **all three** AVR profiles: `uno328p`, `nano328p`, and `nano328pOld`. All three use the same `.bin`. If the binary changed, also update their shared firmware URL version suffix. Save the file and publish the HTML and binary together; the uploader rejects binaries that do not match this metadata.

   Do not change the Nano R4 profile's metadata when rebuilding AVR firmware. If you change the configuration structure, update the browser's patch offsets and validation together as well.

5. Run the application and programming checks in the [main README](../README.md). Refresh an existing Chrome/Edge tab to load the changed HTML and clear its in-memory firmware cache; an already running local server can be reused. Rebuilding does not update a board: use the documented **Program** workflow if you want to test the changed firmware on hardware.

6. Clean up the temporary build directory after checking the result. The following guard limits removal to this guide's temporary folder name directly inside the system temporary directory.

   ```powershell
   $studioResolvedBuild = (Resolve-Path -LiteralPath $studioFirmwareBuild -ErrorAction Stop).Path
   $studioResolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
   if ([IO.Path]::GetDirectoryName($studioResolvedBuild) -ne $studioResolvedTemp -or [IO.Path]::GetFileName($studioResolvedBuild) -notlike 'led-curve-avr-build-*') {
       throw 'Refusing to remove an unexpected build directory.'
   }
   Remove-Item -LiteralPath $studioResolvedBuild -Recurse -Force -ErrorAction Stop
   ```

   Success: the temporary build directory is gone. The firmware source and packaged binary remain in the checkout.

## Nano R4 build status

The Nano R4 binary is retained as supplied. Its Renesas board core was unavailable in the review environment, so a reproducible rebuild was not verified. Do not run the AVR build commands against that sketch or substitute the AVR binary. Its existing SHA-256 is `237eda6dc17366f18a963d0c34f12aaf3c325c2b209d0c389f0b78f177fc83dc`.
