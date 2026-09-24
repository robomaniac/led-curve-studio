# Sample image assets

- `led-curve-2026-09-24.gif`: supplied example animation exported from LED Curve Studio, displayed at 360 pixels wide in the main README. The file is 480 x 360 pixels with 21 frames and a 1.05-second loop; it is separate from the app's 1.70-second default cycle.
- `led-curve-studio-overview.png`: browser screenshot of the app with the cyan double-pulse default, captured directly from the app panel for the main README, excluding the surrounding page background. The layout and curve reproduce the supplied reference screenshot.
- `AI_esp32_assistant.png`: original supplied photograph, kept unchanged.
- `AI_esp32_assistant_unlit.png`: the app's default sample. The LED is off, with a subtle warm ivory diffuser that blends into the enclosure. This copy was edited with the built-in image generation tool and is also embedded in `index.html` for offline use.

The default animated overlay is a rounded pill centered at `(827.6, 377.8)` in the `1448 × 1086` image, sized `104 × 22` pixels and rotated `28°` clockwise. Coordinates are normalized for responsive resizing. The default animation is cyan-blue (`#20cfff`), using two smooth pulses per 1.70-second cycle with automatic playback. The default glow spread is `0.75×`. The live preview and GIF export use a translucent light core with gentle spill and no bright outline.

## Arduino Nano R4 comparison

The main README displays these two cropped animations side by side at 300 x 200 pixels. Both files are 480 x 320 pixels and loop continuously. FFmpeg was used to crop, resize, and encode the GIFs without changing frame counts or frame durations. No brightness correction was applied.

| README asset | Original file (preserved unchanged) | Crop in original pixels | Animation |
| --- | --- | --- | --- |
| `arduino_R4_simulation_comparison.gif` | `arduino_R4_1hz_blink.gif` | 300 x 200 at x=105, y=70; resized to 480 x 320 | 20 frames, 50 ms each, 1.00-second loop |
| `arduino_R4_hardware_comparison.gif` | `arduino_R4_real_blink.GIF` | 480 x 320 at x=90, y=85 | 35 frames, 50 ms each, 1.75-second loop |

Crop coordinates start at the top-left corner. The boards are framed at similar scales with the LEDs visible. The physical board's yellow LED is much brighter in person than the recording conveys. The clips retain their different loop durations and are not synchronized.

## Image editing prompts

### Initial unlit copy

Use case: precise-object-edit. Asset type: an unlit product photograph for an LED animation editor. Edit target: the supplied photograph images/AI_esp32_assistant.png, a white ESP32 assistant enclosure on a wooden desk with keys upper left, a plant upper right and black leather lower right. Change ONLY the small glowing LED light bar on the enclosure and its warm yellow halo: turn that LED completely OFF, remove its emitted glow and yellow light spill from the immediately surrounding white enclosure, and reveal a natural unlit pale gray frosted diffuser in the EXACT same rounded pill slot. The LED is centered at approximately 57.15% from the left and 34.84% from the top; the pill is about 6.92% of image width long, 1.92% of image height thick, tilted clockwise 28 degrees. Keep the pill center, length, thickness and angle unchanged. Preserve the original composition, camera, crop, aspect ratio 4:3, enclosure geometry, black oval camera, surface textures, keys, plant, desk, leather and all lighting outside the LED area. Do not add anything, do not alter the housing design, do not resize or relocate any object. Return the same full photograph with that single LED unlit, ideally at original 1448x1086 resolution. No text, labels, arrows, watermark, or animation overlay.

### Subtle diffuser refinement

Use case: precise-object-edit. Edit target: the attached unlit ESP32 assistant product photo. Make ONLY the small gray rounded-pill LED diffuser on the white enclosure much more subtle. It must be OFF, nearly invisible at a glance, a very pale warm ivory translucent inset closely matching the surrounding white housing, with only a hairline soft edge and extremely faint depth shading. Remove the obvious medium gray flat bar appearance. No black/gray outline, no glow, no yellow halo, no emitted light. It should look like a discreet frosted window flush with the enclosure, not a contrasting sticker or button. Preserve its exact geometry: center (827.6,377.8), length104 px, thickness22 px, clockwise28 degrees in the original1448x1086 image. Preserve all other pixels/objects/composition/camera/crop/aspect ratio4:3 as closely as possible: keys, plant, desk, white housing, camera and leather unchanged. Keep original1448x1086 dimensions. Only refine the diffuser material/color; no redesign, no added text or watermark.
