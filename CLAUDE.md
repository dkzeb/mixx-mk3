# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project adds **Native Instruments Maschine MK3** controller support to the open-source [Mixxx DJ software](https://github.com/mixxxdj/mixxx). It is currently a **pre-integration standalone project** — the Mixxx codebase has not been cloned into this repo yet.

The core deliverable is `libmk3`, a C library that provides hardware abstraction for the MK3 controller over USB, plus CLI tools for testing. Eventually this will be integrated into Mixxx as either a built-in controller mapping or an external controller module.

## Architecture

### libmk3 (`external/mk3/`)

A static C11 library using an **opaque type pattern** (`mk3_t` is forward-declared in `mk3.h`, defined in `mk3_internal.h`). Communicates with the MK3 over USB via `libusb-1.0`.

**Module structure:**

| Module | Purpose |
|---|---|
| `mk3.c` / `mk3.h` | Device lifecycle: `mk3_open()` / `mk3_close()`. Claims USB interfaces 4 (HID) and 5 (display). |
| `mk3_display.c/h` | Two 480x272 RGB565 screens. Frame diffing sends only changed regions over bulk endpoint 0x04. |
| `mk3_input.c/h` | Callback-driven input polling. Report 0x01 = buttons/knobs/stepper. Report 0x02 = pad pressures. |
| `mk3_input_map.c/h` | Defines 74 buttons (bit-masked across 10 byte addresses 0x01-0x0A), 16 pads, 11 knobs. |
| `mk3_output.c/h` | LED control via HID interrupt output (endpoint 0x03). |
| `mk3_output_map.c/h` | 103 LED definitions — 49 monochromatic (0-63 brightness) and 54 indexed color (0-71 palette). |
| `mk3_internal.h` | Internal struct definition, USB constants, buffer sizes. |

**USB details:** Vendor `0x17CC`, Product `0x1600`. Interface 4 = HID (interrupt IN 0x83, OUT 0x03). Interface 5 = Display (bulk OUT 0x04).

**Input model:** Callback-based — register handlers via `mk3_input_set_*_callback()`, then call `mk3_input_poll()` in a loop. Buttons use edge detection against the last HID buffer. Pads use a pressure threshold of 256. Knobs handle 16-bit wraparound at ±2048.

**Known issue:** Partial display rendering has a bug when selecting pads in DAW sampler mode. Use `mk3_display_disable_partial_rendering(dev, true)` as workaround.

### CLI Tools (`external/mpi-tools/`)

| Tool | Purpose | Extra deps |
|---|---|---|
| `mk3_test` | Test input events, partial display rendering, and random LED output | — |
| `mk3_cli` | Render text or piped RGB565 pixel data to MK3 screens | `freetype2` |
| `audio_cli` | Audio pipeline demo (sine gen, sampler, DSP plugins, PipeWire) | `libsndfile`, Mixxx `audio` lib |

`mk3_test` modes: `--input` (log HID events), `--partial` (display stress test), `--output` (random LED cycling).

## Build

CMake-based. The tools undefine JUCE preprocessor symbols, indicating they're built as part of a larger Mixxx/JUCE build tree.

### Building libmk3 and tools standalone

```bash
# Dependencies (Debian/Ubuntu)
sudo apt install libusb-1.0-0-dev libfreetype-dev pkg-config cmake build-essential

mkdir build && cd build
cmake ..
cmake --build .
```

### Running tools (requires MK3 hardware connected via USB)

```bash
# Test input events
./mk3_test --input

# Test display
./mk3_test --partial

# Test LEDs
./mk3_test --output

# Render text to left screen
./mk3_cli --text "Hello" --target left
```

The MK3 must be accessible without root — add a udev rule or run with appropriate permissions.

## Mixxx Integration Context

Mixxx supports HID controllers via JavaScript mapping files. A mapping consists of:

1. **XML preset file** — declares vendor/product IDs, links JS script files
2. **JavaScript controller script** — implements `init()`, `shutdown()`, `incomingData(data, length)` and uses `engine.getValue()`/`engine.setValue()` to interact with Mixxx controls, and `controller.send()` for output

Mixxx also has a **new controller system** (in development) supporting:
- Separate HID and bulk controller declarations with vendor/product IDs and interface numbers
- QML-based screen rendering via `mixxx.QMLRenderer` piped to bulk endpoints
- This is the likely integration path for MK3 screens (bulk interface 5)

**Key Mixxx source paths** (in the Mixxx repo):
- `src/controllers/hid/` — HID controller C++ backend
- `src/controllers/bulk/` — USB bulk transfer controller backend
- `src/controllers/rendering/` — Controller screen rendering engine
- `res/controllers/` — JavaScript mapping files and XML presets

**Reference controller:** The Kontrol S4 Mk3 (vendor `0x17CC`, product `0x1310`) uses the same dual HID+bulk pattern — HID on interface 4, screens on interface 5. Its mapping is the closest architectural reference.

## Code Conventions

- C11 standard throughout
- All public API functions prefixed with `mk3_`
- Error handling uses `goto cleanup` pattern with manual `malloc`/`free`
- String-based lookup for buttons/LEDs by name (e.g., `"play"`, `"g1"`)
- HID reports use raw byte arrays with defined report IDs (0x01, 0x02 for input; 0x80, 0x81 for output)
