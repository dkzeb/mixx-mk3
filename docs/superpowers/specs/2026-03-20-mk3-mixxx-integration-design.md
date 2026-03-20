# Maschine MK3 + Mixxx Standalone DJ Unit — Design Spec

## Overview

Turn a Raspberry Pi 4 + Native Instruments Maschine MK3 into a standalone headless DJ unit running Mixxx. The MK3's two screens serve as the primary display, and its controls (pads, buttons, knobs, stepper wheel, LEDs) provide full two-deck DJ performance control.

## Architecture

Three deliverables:

1. **`mk3-mixxx-mapping`** — Mixxx JS HID controller mapping for input/LEDs
2. **`mk3-screen-daemon`** — C daemon for rendering to MK3 screens via libmk3
3. **`mk3-pi-setup`** — Raspberry Pi setup script for headless Mixxx + MK3

### Integration Model

- **Input/LEDs:** Mixxx's standard JS HID mapping system. Mixxx opens the HID interface (interface 4) via hidapi/hidraw. JavaScript parses HID reports and controls Mixxx via `engine.setValue()`. LED output via `controller.send()`.
- **Screens:** Separate C daemon using libmk3's display module. Claims only USB bulk interface 5 via libusb. On Linux, Mixxx uses the hidraw backend for HID (interface 4) and the daemon uses libusb for bulk (interface 5) — these are independent kernel paths and do not conflict.
- **Why this split:** JS is fine for event-driven input but can't handle real-time framebuffer capture and pixel processing on a Pi 4. Native C handles the screen pipeline efficiently. This split also maps to the phased roadmap — the screen daemon is Phase 1 and gets replaced by Mixxx's bulk controller system in Phase 2.

### Required libmk3 Change

`mk3_open()` currently claims both interface 4 (HID) and interface 5 (display). The screen daemon needs to claim only interface 5 while Mixxx holds interface 4. A new function `mk3_open_display()` must be added to libmk3 that:
- Opens the USB device and claims only interface 5 (display)
- Does not touch interface 4 (HID) — no detach, no claim
- Allocates display buffers but not input/LED state
- Returns an `mk3_t*` usable with `mk3_display_draw()` and `mk3_display_clear()`

This is a Phase 1 prerequisite.

### USB Device Details

- Vendor: `0x17CC`, Product: `0x1600`
- Interface 4: HID (interrupt IN `0x83`, OUT `0x03`) — buttons, pads, knobs, stepper, LEDs
- Interface 5: Display (bulk OUT `0x04`) — two 480x272 RGB565 screens
- 64-byte HID input packets. Report `0x01` = buttons/knobs/stepper. Report `0x02` = pad pressures.
- HID output reports `0x80` (63 bytes) and `0x81` (42 bytes) for LEDs.

## Component 1: JS HID Mapping (`mk3-mixxx-mapping`)

### Files

- `Native-Instruments-Maschine-MK3.xml` — preset with device matching
- `Native-Instruments-Maschine-MK3.js` — controller script

### Control Layout

Split surface with mode layers.

#### Fixed Controls (always active)

| Control | Deck A | Deck B |
|---|---|---|
| EQ Hi/Mid/Lo + Filter | Knobs K1-K4 | Knobs K5-K8 |
| Volume | Master Vol knob | Headphone Vol knob |
| Play/Pause | `play` button | `stop` button (remapped) |
| Cue | `recCountIn` | `tapMetro` |
| Sync | `restartLoop` | `eraseReplace` |
| Load track | `d1` | `d5` |
| Screen | Left = Deck A | Right = Deck B |

#### Navigation (always active)

- Stepper wheel: library scrolling
- Nav push: load selected track
- Nav up/down/left/right: library navigation
- `shift`: modifier for secondary functions

#### Mode Layers (G1-G4 select mode, pads remap)

Pad physical layout is a 4x4 grid:
```
 1  2  3  4    (top row)
 5  6  7  8
 9 10 11 12
13 14 15 16    (bottom row)
```

Top two rows (pads 1-8) = Deck A, bottom two rows (pads 9-16) = Deck B.

| Mode | G button | Pads 1-8 (Deck A) | Pads 9-16 (Deck B) |
|---|---|---|---|
| Hot Cues | G1 | Hotcues 1-8 | Hotcues 1-8 |
| Loops | G2 | Loop sizes (1/8 to 16 beats) | Loop sizes |
| Sampler | G3 | Samplers 1-8 | Samplers 9-16 |
| Effects | G4 | FX unit 1 params | FX unit 2 params |

#### LED Feedback

- Pad colors: reflect state (hot cue colors, active loop highlight, playing sample)
- Transport LEDs: play/cue/sync state
- Group LEDs (G1-G4): active mode indicator
- Touchstrip LEDs: could map to track position or volume meter

### Known Limitations

- **Touchstrip input** is not yet implemented in libmk3 (`mk3.h` has a TODO for touchstrip callbacks). Out of scope for Phase 1. Touchstrip LED output is available.
- **`mk3_led_set_brightness()`** is declared in `mk3_output.h` but not in the main public header `mk3.h`. Include `mk3_output.h` for the full LED API. (Not relevant for the JS mapping, which constructs raw reports, but relevant for any C code using libmk3.)

### Input Parsing (from libmk3 protocol knowledge)

**Report 0x01 (buttons/knobs/stepper):**
- Buttons: 74 buttons across 10 byte addresses (0x01-0x0A), each as a bitmask. Edge detection by comparing against last received buffer.
- Knobs: 11 x 16-bit little-endian values. Delta calculation with wraparound handling at +/-2048 (4096 range).
- Stepper: single byte, 16 positions (0x00-0x0F). Direction inferred from position change.

**Report 0x02 (pads):**
- Up to 21 pad entries per report. Each entry: hardware pad index + 12-bit pressure value.
- Pressure threshold of 256 for "pressed" detection.
- Hardware-to-physical pad index mapping via lookup table (hardware indices 0-3 = physical pads 13-16, ..., 12-15 = physical pads 1-4).

### Output (LEDs)

libmk3 defines 103 LEDs: 49 monochromatic and 54 indexed-color.

- Report `0x80` (63 bytes): 49 mono LEDs (brightness 0-63) + 13 indexed color LEDs (sampling, g1-g8, nav directions)
- Report `0x81` (42 bytes): 25 touchstrip LEDs (ts1-ts25) + 16 pad LEDs (p1-p16), indexed colors (0-71)

**Full-report state management:** Mixxx's `controller.send()` sends a complete HID output report. The JS mapping must maintain two in-memory output report buffers (63 bytes for 0x80, 42 bytes for 0x81) and update individual LED byte positions before sending the full report. Each LED change requires re-sending the entire report. This mirrors how libmk3 manages `output_report_80_buffer` and `output_report_81_buffer`.

## Component 2: Screen Daemon (`mk3-screen-daemon`)

### Architecture

```
Mixxx (QT_QPA_PLATFORM=eglfs, renders to DRM/KMS plane)
    -> screen daemon reads KMS plane framebuffer via DRM API
    -> crop/split into left half + right half
    -> downscale each to 480x272 RGB565
    -> libmk3 mk3_display_draw() per screen (display-only mode)
```

### Framebuffer Capture Strategy

When Mixxx runs with `QT_QPA_PLATFORM=eglfs`, it renders via OpenGL ES to a DRM/KMS plane. The rendered content lives in GPU memory, not in a CPU-accessible framebuffer. A simple `/dev/fb0` mmap will not capture GPU-rendered content.

**Primary approach — DRM plane capture:**
1. Open the DRM device (`/dev/dri/card0`)
2. Enumerate planes via `drmModeGetPlaneResources()`
3. Get the active plane's framebuffer via `drmModeGetFB2()`
4. Export as DMA-BUF via `drmPrimeHandleToFD()`
5. `mmap()` the DMA-BUF to read pixels

This captures GPU-rendered content directly from the KMS plane without needing a compositor.

**Fallback approach — linuxfb:**
If DRM capture proves unreliable, Mixxx can run with `QT_QPA_PLATFORM=linuxfb` which renders to a CPU framebuffer at `/dev/fb0`. This disables GPU-accelerated waveform rendering but guarantees a simple, mmap-able capture path. Acceptable for Phase 1 if DRM capture is problematic.

**Fallback approach — cage compositor:**
Run Mixxx under `cage` (a minimal single-window Wayland compositor). Capture frames via `wlr-screencopy` protocol. Adds a dependency but preserves GPU rendering with a well-tested capture path.

### Design Decisions

- **Framerate:** Target 30fps. Two screens at 480x272x2 bytes = ~15MB/s USB bandwidth, well within USB 2.0 limits. libmk3's frame diffing reduces actual transfer to changed regions only.
- **Splitting:** Pi runs at virtual resolution 960x544 (exactly 2x MK3 screen). Left half -> left screen, right half -> right screen. Maps naturally to Mixxx's two-deck layout.
- **Downscaling:** Nearest-neighbor for speed on Pi 4. Bilinear as a configurable option.
- **Process model:** Single-threaded event loop (capture, scale, send, repeat). Simple and predictable.
- **Partial rendering:** Disabled by default for Phase 1. libmk3 has a known partial rendering bug triggered by certain pad interactions. Profile full-frame rendering performance on Pi 4 to determine if this is acceptable (~15MB/s). Enable partial rendering once the bug is fixed.

### Error Handling & Recovery

- **USB disconnect:** Detect via `libusb_bulk_transfer()` returning `LIBUSB_ERROR_NO_DEVICE`. Enter a reconnect polling loop (1s interval) that calls `mk3_open_display()` until the device reappears.
- **Display write failure:** Log the error, skip the frame, continue. After 10 consecutive failures, attempt a full device reconnect.
- **Graceful shutdown:** Handle `SIGTERM` and `SIGINT`. Release USB interface 5, close libusb, exit cleanly. systemd sends `SIGTERM` on `systemctl stop`.
- **Startup synchronization:** On launch, display a static splash screen ("MK3 DJ — Waiting for Mixxx...") until the captured framebuffer contains non-black content, then switch to live mirroring.

### Configuration

Command-line flags or `/etc/mk3-screen-daemon.conf`:
- `--capture drm|linuxfb` (default: drm)
- `--resolution WxH` (default: 960x544)
- `--fps N` (default: 30)
- `--crop X,Y,W,H` (optional, for custom regions)
- `--scale-mode nearest|bilinear` (default: nearest)
- `--no-partial` (disable frame diffing, default for Phase 1)

### Dependencies

- libmk3 (linked statically, using `mk3_open_display()`)
- libusb-1.0
- libdrm (for DRM capture mode)

## Component 3: Pi Setup (`mk3-pi-setup`)

### Base System

Raspberry Pi OS Lite (64-bit, Bookworm or later). No desktop environment.

### Display Configuration

Raspberry Pi OS Bookworm uses KMS/DRM by default (`vc4-kms-v3d` overlay). Legacy firmware display settings (`hdmi_group`, `hdmi_mode`, `hdmi_cvt`) do not apply.

Configuration for a headless virtual display:

`/boot/config.txt`:
- `hdmi_force_hotplug:0=1` — force HDMI output even with no monitor connected
- `dtoverlay=vc4-kms-v3d` — KMS display driver (default on Bookworm)

`/boot/cmdline.txt` (append):
- `video=HDMI-A-1:960x544@30` — set custom resolution matching 2x MK3 screen

Mixxx launches with `QT_QPA_PLATFORM=eglfs` for GPU-accelerated rendering directly to the DRM/KMS plane.

### Boot Sequence

1. systemd starts Mixxx (auto-login, headless, `After=sound.target`)
2. systemd starts `mk3-screen-daemon` (after Mixxx, `Restart=on-failure`)
3. Mixxx auto-loads MK3 HID mapping on USB device detection

### udev Rule

`/etc/udev/rules.d/99-mk3.rules`:
```
SUBSYSTEM=="usb", ATTR{idVendor}=="17cc", ATTR{idProduct}=="1600", MODE="0660", GROUP="audio"
```

### Audio

PipeWire or ALSA — configured for low-latency. Output device is user-configurable (onboard, HDMI, USB audio interface).

### Setup Script Deliverable

`mk3-pi-setup.sh` that runs on a fresh Raspberry Pi OS Lite install:
1. Installs Mixxx (from Debian repo or builds from source with `-DHID=ON -DBULK=ON`)
2. Builds and installs `mk3-screen-daemon`
3. Copies HID mapping files to `~/.mixxx/controllers/`
4. Installs udev rules, systemd units
5. Configures `/boot/config.txt` and `/boot/cmdline.txt` for virtual display
6. Configures audio defaults

Avoids the maintenance burden of a full custom OS image while remaining reproducible.

## Phased Roadmap

### Phase 1 — Standalone DJ unit with framebuffer mirror

Deliverables:
1. libmk3 enhancement: `mk3_open_display()` for display-only access
2. JS HID mapping (full input parsing + LED output)
3. Screen daemon (DRM plane capture + display, with linuxfb fallback)
4. Pi setup script

Result: Working two-deck DJ controller. MK3 screens show Mixxx's standard UI. All input controls functional.

### Phase 2 — Migrate screens to Mixxx bulk controller system

- Write Mixxx bulk controller preset for MK3 display (interface 5, endpoint 0x04)
- Use Mixxx's `QMLRenderer` to render QML directly to the screens
- Screen daemon becomes optional/deprecated

Result: Screens rendered by Mixxx, tighter integration, potentially better performance.

### Phase 3 — Custom hybrid UI

- Design custom QML screens optimized for 480x272 (large waveforms, big text, high contrast)
- Leverage Mixxx's waveform rendering components
- Mode-aware screens (hot cue view, loop view, effects view, library browser)
- Custom layouts for track info, BPM, EQ visualization

Result: Purpose-built DJ UI rivaling commercial standalone units.

## Build Order (Phase 1)

1. libmk3: add `mk3_open_display()` function
2. JS HID mapping — input parsing + LED output
3. Screen daemon — DRM capture pipeline
4. Pi setup — systemd integration and configuration
5. Hardware testing and iteration
