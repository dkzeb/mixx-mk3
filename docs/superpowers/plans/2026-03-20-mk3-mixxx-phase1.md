# MK3 Mixxx Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working two-deck DJ controller for Mixxx using the MK3, with screen mirroring via a standalone daemon, deployable on a Raspberry Pi 4.

**Architecture:** JS HID mapping handles input/LEDs via Mixxx's standard controller system. A separate C daemon captures the Pi's display and mirrors it to the MK3's two screens via libmk3. A setup script configures the Pi for headless operation.

**Tech Stack:** C11 (libmk3, screen daemon), JavaScript (Mixxx HID mapping), CMake, libusb-1.0, libdrm, systemd

**Spec:** `docs/superpowers/specs/2026-03-20-mk3-mixxx-integration-design.md`

---

### Task 1: Add `mk3_open_display()` to libmk3

libmk3's `mk3_open()` claims both USB interfaces 4 (HID) and 5 (display). The screen daemon needs to claim only interface 5 while Mixxx holds interface 4. Add a display-only open function.

**Files:**
- Modify: `external/mk3/mk3.c`
- Modify: `external/mk3/mk3.h`

- [ ] **Step 1: Add `mk3_open_display()` declaration to `mk3.h`**

Add after the `mk3_open()` declaration (line 15):

```c
// Open device for display-only access (claims interface 5 only, not interface 4).
// Use when another process (e.g., Mixxx) holds the HID interface.
mk3_t* mk3_open_display(void);
```

- [ ] **Step 2: Implement `mk3_open_display()` in `mk3.c`**

Add after `mk3_open()` (after line 128). This is a slimmed-down version that skips HID interface 4:

```c
mk3_t* mk3_open_display(void) {
    libusb_device_handle* handle = NULL;
    mk3_t* dev = NULL;
    bool display_claimed = false;

    if (!mk3_acquire_libusb())
        return NULL;

    handle = libusb_open_device_with_vid_pid(g_libusb_context, VENDOR_ID, PRODUCT_ID);
    if (!handle) {
        fprintf(stderr, "MK3 not found.\n");
        goto cleanup;
    }

    if (libusb_claim_interface(handle, DISPLAY_INTERFACE) != 0) {
        fprintf(stderr, "Failed to claim interface %d (Display)\n", DISPLAY_INTERFACE);
        goto cleanup;
    }
    display_claimed = true;

    dev = calloc(1, sizeof(mk3_t));
    if (!dev)
        goto cleanup;

    dev->handle = handle;
    dev->disable_partial_rendering = false;

    dev->clear_frame_buffer = calloc(WIDTH * HEIGHT, sizeof(uint16_t));
    if (!dev->clear_frame_buffer)
        goto cleanup;

    for (int i = 0; i < 2; i++) {
        dev->last_frame[i] = calloc(WIDTH * HEIGHT, sizeof(uint16_t));
        if (!dev->last_frame[i])
            goto cleanup;
        dev->has_last_frame[i] = false;
    }

    return dev;

cleanup:
    if (dev) {
        for (int i = 0; i < 2; i++) {
            free(dev->last_frame[i]);
            dev->last_frame[i] = NULL;
        }
        free(dev->clear_frame_buffer);
        dev->clear_frame_buffer = NULL;
        free(dev);
        dev = NULL;
    }

    if (handle) {
        if (display_claimed)
            libusb_release_interface(handle, DISPLAY_INTERFACE);
        libusb_close(handle);
        handle = NULL;
    }

    mk3_release_libusb();
    return NULL;
}
```

- [ ] **Step 3: Add `mk3_close_display()` to handle display-only teardown**

Add declaration to `mk3.h`:
```c
void mk3_close_display(mk3_t* dev);
```

Add implementation to `mk3.c` after `mk3_close()`:
```c
void mk3_close_display(mk3_t* dev) {
    if (!dev) return;

    for (int i = 0; i < 2; i++) {
        free(dev->last_frame[i]);
        dev->last_frame[i] = NULL;
    }

    free(dev->clear_frame_buffer);
    dev->clear_frame_buffer = NULL;

    libusb_release_interface(dev->handle, DISPLAY_INTERFACE);
    libusb_close(dev->handle);
    mk3_release_libusb();
    free(dev);
}
```

- [ ] **Step 4: Build and verify**

Run: `cd /home/zeb/dev/mixx-mk3 && mkdir -p build && cd build && cmake .. && cmake --build .`

Expected: Compiles without errors. No behavioral change to existing `mk3_open()`/`mk3_close()`.

- [ ] **Step 5: Commit**

```bash
git add external/mk3/mk3.h external/mk3/mk3.c
git commit -m "feat(libmk3): add mk3_open_display() for display-only USB access

Allows a separate process to claim only the display interface (5)
while another process (e.g., Mixxx) holds the HID interface (4)."
```

---

### Task 2: Create top-level CMakeLists.txt

There is no top-level CMakeLists.txt. The existing build files are in subdirectories. Create a root CMake file that builds libmk3, the existing tools, and (later) the screen daemon.

**Files:**
- Create: `CMakeLists.txt` (project root)

- [ ] **Step 1: Create root CMakeLists.txt**

```cmake
cmake_minimum_required(VERSION 3.16)
project(mixx-mk3 C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_subdirectory(external/mk3)
add_subdirectory(external/mpi-tools/mk3_test)
add_subdirectory(external/mpi-tools/mk3_cli)
# audio_cli requires the Mixxx audio lib, skip for standalone builds
# add_subdirectory(external/mpi-tools/audio_cli)
```

- [ ] **Step 2: Build and verify**

```bash
cd /home/zeb/dev/mixx-mk3 && rm -rf build && mkdir build && cd build && cmake .. && cmake --build .
```

Expected: Builds `libmk3.a`, `mk3_test`, `mk3_cli` successfully.

- [ ] **Step 3: Commit**

```bash
git add CMakeLists.txt
git commit -m "build: add top-level CMakeLists.txt"
```

---

### Task 3: Create Mixxx HID mapping XML preset

The XML preset declares the MK3's USB vendor/product IDs and links the JavaScript script. Mixxx uses this to auto-detect the controller.

**Files:**
- Create: `mapping/Native-Instruments-Maschine-MK3.xml`

- [ ] **Step 1: Create the XML preset**

```xml
<?xml version="1.0" encoding="utf-8"?>
<MixxxControllerPreset schemaVersion="1" mixxxVersion="2.4+">
    <info>
        <name>Native Instruments Maschine MK3</name>
        <author>mixx-mk3</author>
        <description>HID mapping for the Native Instruments Maschine MK3 controller.
Two-deck DJ control with mode layers for hot cues, loops, samplers, and effects.</description>
        <devices>
            <product protocol="hid" vendor_id="0x17cc" product_id="0x1600" />
        </devices>
    </info>
    <controller id="MaschineMK3">
        <scriptfiles>
            <file filename="Native-Instruments-Maschine-MK3.js" functionprefix="MaschineMK3"/>
        </scriptfiles>
    </controller>
</MixxxControllerPreset>
```

- [ ] **Step 2: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.xml
git commit -m "feat(mapping): add MK3 HID controller XML preset"
```

---

### Task 4: Create JS mapping — scaffolding and button map

Build the JavaScript mapping skeleton with the button definitions ported from `external/mk3/mk3_input_map.c`. This task creates the file with init/shutdown/incomingData and the complete button map. No Mixxx control bindings yet.

**Files:**
- Create: `mapping/Native-Instruments-Maschine-MK3.js`

- [ ] **Step 1: Create JS mapping with scaffolding and button definitions**

Port the 74 buttons from `external/mk3/mk3_input_map.c`. Each button has a byte address (offset within the HID report buffer) and a bitmask.

```javascript
// Native Instruments Maschine MK3 — Mixxx HID mapping
// Ported from libmk3 (external/mk3/)

// eslint-disable-next-line no-var
var MaschineMK3 = {};

// ============================================================
// Button definitions: { name: [byteAddress, bitmask] }
// Byte addresses are offsets within the 64-byte HID report
// (buffer[0] = report ID 0x01, buttons start at buffer[1])
// Ported from: external/mk3/mk3_input_map.c
// ============================================================
MaschineMK3.buttons = {
    // Byte 0x01
    "navPush": [0x01, 0x01],
    "pedalConnected": [0x01, 0x02],
    "navUp": [0x01, 0x04],
    "navRight": [0x01, 0x08],
    "navDown": [0x01, 0x10],
    "navLeft": [0x01, 0x20],
    "shift": [0x01, 0x40],
    "d8": [0x01, 0x80],
    // Byte 0x02 — Group buttons
    "g1": [0x02, 0x01],
    "g2": [0x02, 0x02],
    "g3": [0x02, 0x04],
    "g4": [0x02, 0x08],
    "g5": [0x02, 0x10],
    "g6": [0x02, 0x20],
    "g7": [0x02, 0x40],
    "g8": [0x02, 0x80],
    // Byte 0x03
    "notes": [0x03, 0x01],
    "volume": [0x03, 0x02],
    "swing": [0x03, 0x04],
    "tempo": [0x03, 0x08],
    "noteRepeatArp": [0x03, 0x10],
    "lock": [0x03, 0x20],
    // Byte 0x04
    "padMode": [0x04, 0x01],
    "keyboard": [0x04, 0x02],
    "chords": [0x04, 0x04],
    "step": [0x04, 0x08],
    "fixedVel": [0x04, 0x10],
    "scene": [0x04, 0x20],
    "pattern": [0x04, 0x40],
    "events": [0x04, 0x80],
    // Byte 0x05
    "microphoneConnected": [0x05, 0x01],
    "variationNavigate": [0x05, 0x02],
    "duplicateDouble": [0x05, 0x04],
    "select": [0x05, 0x08],
    "solo": [0x05, 0x10],
    "muteChoke": [0x05, 0x20],
    "pitch": [0x05, 0x40],
    "mod": [0x05, 0x80],
    // Byte 0x06
    "performFxSelect": [0x06, 0x01],
    "restartLoop": [0x06, 0x02],
    "eraseReplace": [0x06, 0x04],
    "tapMetro": [0x06, 0x08],
    "followGrid": [0x06, 0x10],
    "play": [0x06, 0x20],
    "recCountIn": [0x06, 0x40],
    "stop": [0x06, 0x80],
    // Byte 0x07
    "macroSet": [0x07, 0x01],
    "settings": [0x07, 0x02],
    "arrowRight": [0x07, 0x04],
    "sampling": [0x07, 0x08],
    "mixer": [0x07, 0x10],
    "plugin": [0x07, 0x20],
    // Byte 0x08
    "channelMidi": [0x08, 0x01],
    "arranger": [0x08, 0x02],
    "browserPlugin": [0x08, 0x04],
    "arrowLeft": [0x08, 0x08],
    "fileSave": [0x08, 0x10],
    "auto": [0x08, 0x20],
    // Byte 0x09
    "d1": [0x09, 0x01],
    "d2": [0x09, 0x02],
    "d3": [0x09, 0x04],
    "d4": [0x09, 0x08],
    "d5": [0x09, 0x10],
    "d6": [0x09, 0x20],
    "d7": [0x09, 0x40],
    "navTouch": [0x09, 0x80],
    // Byte 0x0A — Knob touch sensors
    "knobTouch8": [0x0A, 0x01],
    "knobTouch7": [0x0A, 0x02],
    "knobTouch6": [0x0A, 0x04],
    "knobTouch5": [0x0A, 0x08],
    "knobTouch4": [0x0A, 0x10],
    "knobTouch3": [0x0A, 0x20],
    "knobTouch2": [0x0A, 0x40],
    "knobTouch1": [0x0A, 0x80],
};

// Hardware pad index (0-15) -> physical pad number (1-16)
// Physical layout:
//  1  2  3  4   (top row)
//  5  6  7  8
//  9 10 11 12
// 13 14 15 16   (bottom row)
MaschineMK3.padHwToPhysical = [
    13, 14, 15, 16,  // HW 0-3
     9, 10, 11, 12,  // HW 4-7
     5,  6,  7,  8,  // HW 8-11
     1,  2,  3,  4,  // HW 12-15
];

// Knob descriptors: [lsbAddr, msbAddr] in report 0x01 buffer
// Ported from: external/mk3/mk3_input.c knob_descriptors[]
MaschineMK3.knobs = {
    "k1": [12, 13],
    "k2": [14, 15],
    "k3": [16, 17],
    "k4": [18, 19],
    "k5": [20, 21],
    "k6": [22, 23],
    "k7": [24, 25],
    "k8": [26, 27],
    "micInGain": [36, 37],
    "headphoneVolume": [38, 39],
    "masterVolume": [40, 41],
};

MaschineMK3.STEPPER_ADDR = 11;
MaschineMK3.PAD_REPORT_ID = 0x02;
MaschineMK3.PAD_PRESSURE_THRESHOLD = 256;
MaschineMK3.PAD_DATA_START = 1;
MaschineMK3.PAD_ENTRY_LENGTH = 3;
MaschineMK3.PAD_MAX_ENTRIES = 21;
MaschineMK3.PAD_COUNT = 16;

// ============================================================
// State
// ============================================================
MaschineMK3.lastInputBuffer = null;  // For button edge detection
MaschineMK3.knobValues = {};         // Last known knob values
MaschineMK3.knobInitialized = {};    // Whether each knob has a baseline
MaschineMK3.padPressed = [];         // Boolean per pad (0-indexed, 0-15)
MaschineMK3.stepperPosition = -1;    // -1 = uninitialized
MaschineMK3.shiftPressed = false;
MaschineMK3.activeMode = "hotcues";  // "hotcues", "loops", "sampler", "effects"

// LED output report buffers (sent via controller.send())
MaschineMK3.outputReport80 = [];     // 63 bytes, report ID 0x80
MaschineMK3.outputReport81 = [];     // 42 bytes, report ID 0x81

// ============================================================
// Lifecycle
// ============================================================
MaschineMK3.init = function(id, debugging) {
    // Initialize state
    MaschineMK3.lastInputBuffer = new Array(64).fill(0);
    MaschineMK3.padPressed = new Array(16).fill(false);

    // Initialize LED output buffers
    MaschineMK3.outputReport80 = new Array(63).fill(0);
    MaschineMK3.outputReport80[0] = 0x80;
    MaschineMK3.outputReport81 = new Array(42).fill(0);
    MaschineMK3.outputReport81[0] = 0x81;

    // Initialize knob state
    var knobNames = Object.keys(MaschineMK3.knobs);
    for (var i = 0; i < knobNames.length; i++) {
        MaschineMK3.knobValues[knobNames[i]] = 0;
        MaschineMK3.knobInitialized[knobNames[i]] = false;
    }

    MaschineMK3.activeMode = "hotcues";
    MaschineMK3.shiftPressed = false;
    MaschineMK3.stepperPosition = -1;

    print("MaschineMK3: initialized (id=" + id + ")");
};

MaschineMK3.shutdown = function() {
    // Turn off all LEDs
    for (var i = 0; i < 63; i++) {
        MaschineMK3.outputReport80[i] = 0;
    }
    MaschineMK3.outputReport80[0] = 0x80;
    controller.send(MaschineMK3.outputReport80, MaschineMK3.outputReport80.length, 0x80);

    for (var j = 0; j < 42; j++) {
        MaschineMK3.outputReport81[j] = 0;
    }
    MaschineMK3.outputReport81[0] = 0x81;
    controller.send(MaschineMK3.outputReport81, MaschineMK3.outputReport81.length, 0x81);

    print("MaschineMK3: shutdown");
};

// ============================================================
// Input parsing
// ============================================================
MaschineMK3.incomingData = function(data, length) {
    if (length < 1) return;

    var reportId = data[0];
    if (reportId === 0x01) {
        MaschineMK3.processReport01(data, length);
    } else if (reportId === MaschineMK3.PAD_REPORT_ID) {
        MaschineMK3.processReport02(data, length);
    }
};

// --- Report 0x01: Buttons, Knobs, Stepper ---
MaschineMK3.processReport01 = function(data, length) {
    MaschineMK3.processButtons(data, length);
    MaschineMK3.processKnobs(data, length);
    MaschineMK3.processStepper(data, length);

    // Save buffer for next edge detection
    MaschineMK3.lastInputBuffer = [];
    for (var i = 0; i < length; i++) {
        MaschineMK3.lastInputBuffer[i] = data[i];
    }
};

MaschineMK3.processButtons = function(data, length) {
    var lastBuf = MaschineMK3.lastInputBuffer;
    var hadLastReport = (lastBuf && lastBuf.length > 0 && lastBuf[0] === 0x01);

    var buttonNames = Object.keys(MaschineMK3.buttons);
    for (var i = 0; i < buttonNames.length; i++) {
        var name = buttonNames[i];
        var addr = MaschineMK3.buttons[name][0];
        var mask = MaschineMK3.buttons[name][1];

        if (addr >= length) continue;

        var nowPressed = (data[addr] & mask) !== 0;
        var wasPressed = false;
        if (hadLastReport && addr < lastBuf.length) {
            wasPressed = (lastBuf[addr] & mask) !== 0;
        }

        if (nowPressed && !wasPressed) {
            MaschineMK3.onButtonPress(name);
        } else if (!nowPressed && wasPressed) {
            MaschineMK3.onButtonRelease(name);
        }
    }
};

MaschineMK3.computeKnobDelta = function(previous, current) {
    var delta = current - previous;
    // Handle 16-bit wraparound (MK3 knobs wrap at 4096)
    if (delta > 2048) {
        delta -= 4096;
    } else if (delta < -2048) {
        delta += 4096;
    }
    return delta;
};

MaschineMK3.processKnobs = function(data, length) {
    var knobNames = Object.keys(MaschineMK3.knobs);
    for (var i = 0; i < knobNames.length; i++) {
        var name = knobNames[i];
        var lsb = MaschineMK3.knobs[name][0];
        var msb = MaschineMK3.knobs[name][1];

        if (msb >= length || lsb >= length) continue;

        var currentValue = (data[msb] << 8) | data[lsb];

        if (!MaschineMK3.knobInitialized[name]) {
            MaschineMK3.knobValues[name] = currentValue;
            MaschineMK3.knobInitialized[name] = true;
            continue;
        }

        if (currentValue === MaschineMK3.knobValues[name]) continue;

        var delta = MaschineMK3.computeKnobDelta(MaschineMK3.knobValues[name], currentValue);
        MaschineMK3.knobValues[name] = currentValue;
        MaschineMK3.onKnobChange(name, delta, currentValue);
    }
};

MaschineMK3.processStepper = function(data, length) {
    if (MaschineMK3.STEPPER_ADDR >= length) return;

    var newPos = data[MaschineMK3.STEPPER_ADDR] & 0x0F;

    if (MaschineMK3.stepperPosition === -1) {
        MaschineMK3.stepperPosition = newPos;
        return;
    }

    if (newPos === MaschineMK3.stepperPosition) return;

    var jumpBackward = (MaschineMK3.stepperPosition === 0x00 && newPos === 0x0F);
    var jumpForward = (MaschineMK3.stepperPosition === 0x0F && newPos === 0x00);
    var increment = ((MaschineMK3.stepperPosition < newPos) && !jumpBackward) || jumpForward;
    var direction = increment ? 1 : -1;

    MaschineMK3.stepperPosition = newPos;
    MaschineMK3.onStepperTurn(direction);
};

// --- Report 0x02: Pads ---
MaschineMK3.processReport02 = function(data, length) {
    var offset = MaschineMK3.PAD_DATA_START;
    for (var i = 0; i < MaschineMK3.PAD_MAX_ENTRIES; i++) {
        if (offset + MaschineMK3.PAD_ENTRY_LENGTH > length) break;

        var hwIndex = data[offset];
        if (hwIndex === 0 && i !== 0) break;  // End-of-packet marker
        if (hwIndex >= MaschineMK3.PAD_COUNT) {
            offset += MaschineMK3.PAD_ENTRY_LENGTH;
            continue;
        }

        var physicalPad = MaschineMK3.padHwToPhysical[hwIndex];  // 1-16
        var padIdx = physicalPad - 1;  // 0-indexed

        var pressure = ((data[offset + 1] & 0x0F) << 8) | data[offset + 2];
        var isPressed = pressure > MaschineMK3.PAD_PRESSURE_THRESHOLD;

        if (isPressed && !MaschineMK3.padPressed[padIdx]) {
            MaschineMK3.onPadPress(physicalPad, pressure);
        } else if (!isPressed && MaschineMK3.padPressed[padIdx]) {
            MaschineMK3.onPadRelease(physicalPad);
        }
        MaschineMK3.padPressed[padIdx] = isPressed;

        offset += MaschineMK3.PAD_ENTRY_LENGTH;
    }
};

// ============================================================
// Event handlers (stubs — wired to Mixxx controls in Task 5-8)
// ============================================================
MaschineMK3.onButtonPress = function(name) {
    print("MK3 Button Press: " + name);
};

MaschineMK3.onButtonRelease = function(name) {
    print("MK3 Button Release: " + name);
};

MaschineMK3.onKnobChange = function(name, delta, absolute) {
    print("MK3 Knob: " + name + " delta=" + delta + " abs=" + absolute);
};

MaschineMK3.onStepperTurn = function(direction) {
    print("MK3 Stepper: " + (direction > 0 ? "CW" : "CCW"));
};

MaschineMK3.onPadPress = function(padNumber, pressure) {
    print("MK3 Pad Press: " + padNumber + " pressure=" + pressure);
};

MaschineMK3.onPadRelease = function(padNumber) {
    print("MK3 Pad Release: " + padNumber);
};
```

- [ ] **Step 2: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(mapping): add JS mapping scaffolding with input parsing

Complete HID report parsing for buttons (74), knobs (11), stepper,
and pads (16) ported from libmk3. Event handlers are stubs for now."
```

---

### Task 5: Wire transport controls to Mixxx

Connect the fixed transport buttons (play, cue, sync, load) and shift to Mixxx engine controls for both decks.

**Files:**
- Modify: `mapping/Native-Instruments-Maschine-MK3.js`

- [ ] **Step 1: Replace `onButtonPress` and `onButtonRelease` stubs with transport logic**

Replace the stub `onButtonPress` and `onButtonRelease` functions:

```javascript
MaschineMK3.onButtonPress = function(name) {
    switch (name) {
    // --- Shift ---
    case "shift":
        MaschineMK3.shiftPressed = true;
        break;

    // --- Deck A transport ---
    case "play":
        engine.setValue("[Channel1]", "play",
            engine.getValue("[Channel1]", "play") ? 0 : 1);
        break;
    case "recCountIn":  // Cue A
        engine.setValue("[Channel1]", "cue_default", 1);
        break;
    case "restartLoop":  // Sync A
        engine.setValue("[Channel1]", "sync_enabled",
            engine.getValue("[Channel1]", "sync_enabled") ? 0 : 1);
        break;
    case "d1":  // Load A
        engine.setValue("[Channel1]", "LoadSelectedTrack", 1);
        break;

    // --- Deck B transport ---
    case "stop":  // Play B (remapped)
        engine.setValue("[Channel2]", "play",
            engine.getValue("[Channel2]", "play") ? 0 : 1);
        break;
    case "tapMetro":  // Cue B
        engine.setValue("[Channel2]", "cue_default", 1);
        break;
    case "eraseReplace":  // Sync B
        engine.setValue("[Channel2]", "sync_enabled",
            engine.getValue("[Channel2]", "sync_enabled") ? 0 : 1);
        break;
    case "d5":  // Load B
        engine.setValue("[Channel2]", "LoadSelectedTrack", 1);
        break;

    // --- Mode select ---
    case "g1":
        MaschineMK3.setMode("hotcues");
        break;
    case "g2":
        MaschineMK3.setMode("loops");
        break;
    case "g3":
        MaschineMK3.setMode("sampler");
        break;
    case "g4":
        MaschineMK3.setMode("effects");
        break;

    // --- Navigation ---
    case "navUp":
        engine.setValue("[Library]", "MoveUp", 1);
        break;
    case "navDown":
        engine.setValue("[Library]", "MoveDown", 1);
        break;
    case "navLeft":
        engine.setValue("[Library]", "MoveFocusBackward", 1);
        break;
    case "navRight":
        engine.setValue("[Library]", "MoveFocusForward", 1);
        break;
    case "navPush":
        // Load to the preview deck, or toggle expand
        engine.setValue("[Library]", "GoToItem", 1);
        break;

    default:
        break;
    }
};

MaschineMK3.onButtonRelease = function(name) {
    switch (name) {
    case "shift":
        MaschineMK3.shiftPressed = false;
        break;
    case "recCountIn":
        engine.setValue("[Channel1]", "cue_default", 0);
        break;
    case "tapMetro":
        engine.setValue("[Channel2]", "cue_default", 0);
        break;
    default:
        break;
    }
};

MaschineMK3.setMode = function(mode) {
    MaschineMK3.activeMode = mode;
    MaschineMK3.updateModeLEDs();
    print("MK3 Mode: " + mode);
};
```

- [ ] **Step 2: Wire stepper to library scrolling**

Replace the `onStepperTurn` stub:

```javascript
MaschineMK3.onStepperTurn = function(direction) {
    if (direction > 0) {
        engine.setValue("[Library]", "MoveDown", 1);
    } else {
        engine.setValue("[Library]", "MoveUp", 1);
    }
};
```

- [ ] **Step 3: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(mapping): wire transport, navigation, and mode selection"
```

---

### Task 6: Wire knobs to EQ and volume

Connect knobs K1-K4 to Deck A EQ/filter, K5-K8 to Deck B, and master/headphone volume knobs.

**Files:**
- Modify: `mapping/Native-Instruments-Maschine-MK3.js`

- [ ] **Step 1: Replace `onKnobChange` stub**

```javascript
MaschineMK3.onKnobChange = function(name, delta, absolute) {
    // Normalize: MK3 knobs report 0-4095, Mixxx controls use 0.0-1.0 or -1.0-1.0
    // For EQ/filter, use the absolute value normalized to 0.0-4.0 (Mixxx EQ range)
    // For volume, normalize to 0.0-1.0
    var norm01 = absolute / 4095.0;

    switch (name) {
    // --- Deck A: EQ Hi/Mid/Lo + Filter ---
    case "k1":
        engine.setParameter("[EqualizerRack1_[Channel1]_Effect1]", "parameter3", norm01);
        break;
    case "k2":
        engine.setParameter("[EqualizerRack1_[Channel1]_Effect1]", "parameter2", norm01);
        break;
    case "k3":
        engine.setParameter("[EqualizerRack1_[Channel1]_Effect1]", "parameter1", norm01);
        break;
    case "k4":
        engine.setParameter("[QuickEffectRack1_[Channel1]]", "super1", norm01);
        break;

    // --- Deck B: EQ Hi/Mid/Lo + Filter ---
    case "k5":
        engine.setParameter("[EqualizerRack1_[Channel2]_Effect1]", "parameter3", norm01);
        break;
    case "k6":
        engine.setParameter("[EqualizerRack1_[Channel2]_Effect1]", "parameter2", norm01);
        break;
    case "k7":
        engine.setParameter("[EqualizerRack1_[Channel2]_Effect1]", "parameter1", norm01);
        break;
    case "k8":
        engine.setParameter("[QuickEffectRack1_[Channel2]]", "super1", norm01);
        break;

    // --- Volume ---
    case "masterVolume":
        engine.setParameter("[Master]", "gain", norm01);
        break;
    case "headphoneVolume":
        engine.setParameter("[Master]", "headGain", norm01);
        break;

    default:
        break;
    }
};
```

- [ ] **Step 2: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(mapping): wire EQ knobs and volume controls"
```

---

### Task 7: Wire pads to hot cues, loops, sampler, effects

Implement the four pad modes. Pads 1-8 control Deck A, pads 9-16 control Deck B. The active mode (set by G1-G4) determines what each pad does.

**Files:**
- Modify: `mapping/Native-Instruments-Maschine-MK3.js`

- [ ] **Step 1: Replace pad event handler stubs**

```javascript
MaschineMK3.onPadPress = function(padNumber, pressure) {
    // padNumber: 1-16 physical
    // Pads 1-8 = Deck A, pads 9-16 = Deck B
    var isDeckA = (padNumber <= 8);
    var channel = isDeckA ? "[Channel1]" : "[Channel2]";
    var padIndex = isDeckA ? padNumber : (padNumber - 8);  // 1-8 within the deck

    switch (MaschineMK3.activeMode) {
    case "hotcues":
        engine.setValue(channel, "hotcue_" + padIndex + "_activate", 1);
        break;

    case "loops":
        // Pad 1-8 map to loop sizes: 1/8, 1/4, 1/2, 1, 2, 4, 8, 16 beats
        var loopSizes = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];
        engine.setValue(channel, "beatloop_" + loopSizes[padIndex - 1] + "_toggle", 1);
        break;

    case "sampler":
        var samplerNum = isDeckA ? padIndex : (padIndex + 8);
        var samplerGroup = "[Sampler" + samplerNum + "]";
        if (engine.getValue(samplerGroup, "track_loaded") === 1) {
            engine.setValue(samplerGroup, "cue_gotoandplay", 1);
        } else {
            engine.setValue(samplerGroup, "LoadSelectedTrack", 1);
        }
        break;

    case "effects":
        // Pads 1-3 toggle FX params, pad 4 toggles FX enable
        var fxUnit = isDeckA ? "1" : "2";
        if (padIndex <= 3) {
            var fxGroup = "[EffectRack1_EffectUnit" + fxUnit + "_Effect1]";
            engine.setValue(fxGroup, "parameter" + padIndex,
                engine.getValue(fxGroup, "parameter" + padIndex) > 0.5 ? 0 : 1);
        } else if (padIndex === 4) {
            var unitGroup = "[EffectRack1_EffectUnit" + fxUnit + "]";
            engine.setValue(unitGroup, "enabled",
                engine.getValue(unitGroup, "enabled") ? 0 : 1);
        }
        break;
    }
};

MaschineMK3.onPadRelease = function(padNumber) {
    var isDeckA = (padNumber <= 8);
    var channel = isDeckA ? "[Channel1]" : "[Channel2]";
    var padIndex = isDeckA ? padNumber : (padNumber - 8);

    if (MaschineMK3.activeMode === "hotcues") {
        engine.setValue(channel, "hotcue_" + padIndex + "_activate", 0);
    }
};
```

- [ ] **Step 2: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(mapping): wire pad modes — hotcues, loops, sampler, effects"
```

---

### Task 8: Implement LED feedback

Connect Mixxx control state changes to LED output. Transport LEDs reflect play/cue/sync, group LEDs show active mode, pad LEDs show hot cue colors.

**Files:**
- Modify: `mapping/Native-Instruments-Maschine-MK3.js`

- [ ] **Step 1: Add LED map and helper functions**

Add these after the `outputReport81` initialization in the state section:

```javascript
// LED definitions: { name: [reportId, byteAddr, type] }
// type: "mono" (brightness 0-63) or "indexed" (color index 0-71)
// Ported from: external/mk3/mk3_output_map.c
MaschineMK3.leds = {
    // Mono LEDs (report 0x80)
    "play": [0x80, 42, "mono"],
    "stop": [0x80, 44, "mono"],
    "recCountIn": [0x80, 43, "mono"],
    "restartLoop": [0x80, 38, "mono"],
    "eraseReplace": [0x80, 39, "mono"],
    "tapMetro": [0x80, 40, "mono"],
    "shift": [0x80, 45, "mono"],
    // Indexed LEDs (report 0x80)
    "g1": [0x80, 30, "indexed"],
    "g2": [0x80, 31, "indexed"],
    "g3": [0x80, 32, "indexed"],
    "g4": [0x80, 33, "indexed"],
    // Pad LEDs (report 0x81)
    "p1": [0x81, 26, "indexed"],
    "p2": [0x81, 27, "indexed"],
    "p3": [0x81, 28, "indexed"],
    "p4": [0x81, 29, "indexed"],
    "p5": [0x81, 30, "indexed"],
    "p6": [0x81, 31, "indexed"],
    "p7": [0x81, 32, "indexed"],
    "p8": [0x81, 33, "indexed"],
    "p9": [0x81, 34, "indexed"],
    "p10": [0x81, 35, "indexed"],
    "p11": [0x81, 36, "indexed"],
    "p12": [0x81, 37, "indexed"],
    "p13": [0x81, 38, "indexed"],
    "p14": [0x81, 39, "indexed"],
    "p15": [0x81, 40, "indexed"],
    "p16": [0x81, 41, "indexed"],
};

// Color palette indices for common colors
MaschineMK3.colors = {
    OFF: 0,
    RED: 4,
    ORANGE: 8,
    YELLOW: 16,
    GREEN: 20,
    CYAN: 32,
    BLUE: 40,
    PURPLE: 48,
    PINK: 56,
    WHITE: 68,
};

// NOTE: controller.send() signature varies by Mixxx version. The Kontrol S4 Mk3
// mapping in the Mixxx codebase is the authoritative reference. Verify whether
// the report ID byte should be included in the data array or passed separately.
// The call below assumes: controller.send(dataArray, dataLength, reportId)
MaschineMK3.setLed = function(ledName, value) {
    var led = MaschineMK3.leds[ledName];
    if (!led) return;

    var reportId = led[0];
    var addr = led[1];

    if (reportId === 0x80) {
        MaschineMK3.outputReport80[addr] = value;
        controller.send(MaschineMK3.outputReport80, MaschineMK3.outputReport80.length, 0x80);
    } else if (reportId === 0x81) {
        MaschineMK3.outputReport81[addr] = value;
        controller.send(MaschineMK3.outputReport81, MaschineMK3.outputReport81.length, 0x81);
    }
};
```

- [ ] **Step 2: Add Mixxx control connections in `init()`**

Add to the end of `MaschineMK3.init`:

```javascript
    // Connect to Mixxx controls for LED feedback
    engine.connectControl("[Channel1]", "play_indicator", "MaschineMK3.onPlayA");
    engine.connectControl("[Channel2]", "play_indicator", "MaschineMK3.onPlayB");
    engine.connectControl("[Channel1]", "sync_enabled", "MaschineMK3.onSyncA");
    engine.connectControl("[Channel2]", "sync_enabled", "MaschineMK3.onSyncB");

    // Set initial mode LEDs
    MaschineMK3.updateModeLEDs();
```

- [ ] **Step 3: Add LED callback functions**

```javascript
MaschineMK3.onPlayA = function(value) {
    MaschineMK3.setLed("play", value ? 63 : 0);
};

MaschineMK3.onPlayB = function(value) {
    MaschineMK3.setLed("stop", value ? 63 : 0);
};

MaschineMK3.onSyncA = function(value) {
    MaschineMK3.setLed("restartLoop", value ? 63 : 0);
};

MaschineMK3.onSyncB = function(value) {
    MaschineMK3.setLed("eraseReplace", value ? 63 : 0);
};

MaschineMK3.updateModeLEDs = function() {
    var modes = {"hotcues": "g1", "loops": "g2", "sampler": "g3", "effects": "g4"};
    var modeNames = Object.keys(modes);
    for (var i = 0; i < modeNames.length; i++) {
        var active = (modeNames[i] === MaschineMK3.activeMode);
        MaschineMK3.setLed(modes[modeNames[i]], active ? MaschineMK3.colors.WHITE : MaschineMK3.colors.OFF);
    }
};
```

- [ ] **Step 4: Commit**

```bash
git add mapping/Native-Instruments-Maschine-MK3.js
git commit -m "feat(mapping): add LED feedback for transport, mode, and pads"
```

---

### Task 9: Create screen daemon — project structure and linuxfb capture

Build the screen daemon starting with the simpler linuxfb capture path. This works when Mixxx runs with `QT_QPA_PLATFORM=linuxfb`. DRM capture is added in Task 10.

**Files:**
- Create: `screen-daemon/CMakeLists.txt`
- Create: `screen-daemon/main.c`
- Create: `screen-daemon/capture_linuxfb.c`
- Create: `screen-daemon/capture.h`
- Modify: `CMakeLists.txt` (root — add subdirectory)

- [ ] **Step 1: Create `screen-daemon/capture.h`**

Common interface for capture backends:

```c
#pragma once

#include <stdint.h>
#include <stdbool.h>

typedef struct capture_ctx capture_ctx_t;

// Initialize capture with the given source resolution
capture_ctx_t* capture_open(int width, int height);

// Capture a single frame. Returns pointer to pixel data (XRGB8888 or RGB565 depending on backend).
// The returned pointer is valid until the next call to capture_frame() or capture_close().
// Returns NULL on failure.
const uint8_t* capture_frame(capture_ctx_t* ctx);

// Get bytes per pixel of the captured format
int capture_bpp(capture_ctx_t* ctx);

// Close and free resources
void capture_close(capture_ctx_t* ctx);
```

- [ ] **Step 2: Create `screen-daemon/capture_linuxfb.c`**

```c
#include "capture.h"
#include <fcntl.h>
#include <linux/fb.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <unistd.h>

struct capture_ctx {
    int fd;
    uint8_t* fbmem;
    size_t fbsize;
    int width;
    int height;
    int bpp;  // bytes per pixel
    int stride;
};

capture_ctx_t* capture_open(int width, int height) {
    capture_ctx_t* ctx = calloc(1, sizeof(capture_ctx_t));
    if (!ctx) return NULL;

    ctx->fd = open("/dev/fb0", O_RDONLY);
    if (ctx->fd < 0) {
        perror("Failed to open /dev/fb0");
        free(ctx);
        return NULL;
    }

    struct fb_var_screeninfo vinfo;
    if (ioctl(ctx->fd, FBIOGET_VSCREENINFO, &vinfo) < 0) {
        perror("Failed to get framebuffer info");
        close(ctx->fd);
        free(ctx);
        return NULL;
    }

    ctx->width = vinfo.xres;
    ctx->height = vinfo.yres;
    ctx->bpp = vinfo.bits_per_pixel / 8;
    ctx->stride = vinfo.xres * ctx->bpp;
    ctx->fbsize = ctx->stride * ctx->height;

    if (ctx->width != width || ctx->height != height) {
        fprintf(stderr, "Warning: framebuffer is %dx%d, expected %dx%d\n",
                ctx->width, ctx->height, width, height);
    }

    ctx->fbmem = mmap(NULL, ctx->fbsize, PROT_READ, MAP_SHARED, ctx->fd, 0);
    if (ctx->fbmem == MAP_FAILED) {
        perror("Failed to mmap framebuffer");
        close(ctx->fd);
        free(ctx);
        return NULL;
    }

    fprintf(stderr, "LinuxFB capture: %dx%d %dbpp\n", ctx->width, ctx->height, ctx->bpp * 8);
    return ctx;
}

const uint8_t* capture_frame(capture_ctx_t* ctx) {
    if (!ctx || !ctx->fbmem) return NULL;
    return ctx->fbmem;  // mmap is live — always reflects current framebuffer
}

int capture_bpp(capture_ctx_t* ctx) {
    return ctx ? ctx->bpp : 0;
}

void capture_close(capture_ctx_t* ctx) {
    if (!ctx) return;
    if (ctx->fbmem && ctx->fbmem != MAP_FAILED) {
        munmap(ctx->fbmem, ctx->fbsize);
    }
    if (ctx->fd >= 0) close(ctx->fd);
    free(ctx);
}
```

- [ ] **Step 3: Create `screen-daemon/main.c`**

```c
#include "capture.h"
#include "mk3.h"
#include "mk3_display.h"
#include <signal.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <endian.h>

#define MK3_SCREEN_W 480
#define MK3_SCREEN_H 272
#define DEFAULT_SRC_W 960
#define DEFAULT_SRC_H 544
#define DEFAULT_FPS 30

static volatile bool g_running = true;

static void signal_handler(int sig) {
    (void)sig;
    g_running = false;
}

// Convert XRGB8888 pixel to RGB565
static inline uint16_t xrgb8888_to_rgb565(uint8_t r, uint8_t g, uint8_t b) {
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

// Downscale and convert source framebuffer region to MK3 RGB565 screen buffer
// src_x, src_y: top-left of the region in the source buffer
// src_w, src_h: size of the source region
// src_stride: bytes per row in source
// src_bpp: bytes per pixel in source (3 or 4)
static void scale_region_to_screen(
    const uint8_t* src, int src_x, int src_y, int src_w, int src_h,
    int src_stride, int src_bpp,
    uint16_t* dst)
{
    for (int dy = 0; dy < MK3_SCREEN_H; dy++) {
        int sy = src_y + (dy * src_h) / MK3_SCREEN_H;
        for (int dx = 0; dx < MK3_SCREEN_W; dx++) {
            int sx = src_x + (dx * src_w) / MK3_SCREEN_W;
            const uint8_t* pixel = src + sy * src_stride + sx * src_bpp;
            // DRM format XRGB8888 on little-endian stores as B, G, R, X in memory
            uint8_t b = pixel[0];
            uint8_t g = pixel[1];
            uint8_t r = pixel[2];
            dst[dy * MK3_SCREEN_W + dx] = xrgb8888_to_rgb565(r, g, b);
        }
    }
}

static void print_usage(const char* progname) {
    fprintf(stderr, "Usage: %s [options]\n", progname);
    fprintf(stderr, "  --resolution WxH    Source resolution (default: %dx%d)\n", DEFAULT_SRC_W, DEFAULT_SRC_H);
    fprintf(stderr, "  --fps N             Target framerate (default: %d)\n", DEFAULT_FPS);
    fprintf(stderr, "  --no-partial        Disable partial rendering (default)\n");
    fprintf(stderr, "  --partial           Enable partial rendering (frame diffing)\n");
}

int main(int argc, char** argv) {
    int src_w = DEFAULT_SRC_W;
    int src_h = DEFAULT_SRC_H;
    int fps = DEFAULT_FPS;
    // Partial rendering disabled by default for Phase 1 due to known libmk3 bug.
    // Use --partial to enable once the bug is fixed.
    bool no_partial = true;

    // Parse args
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--resolution") == 0 && i + 1 < argc) {
            sscanf(argv[++i], "%dx%d", &src_w, &src_h);
        } else if (strcmp(argv[i], "--fps") == 0 && i + 1 < argc) {
            fps = atoi(argv[++i]);
        } else if (strcmp(argv[i], "--no-partial") == 0) {
            no_partial = true;
        } else if (strcmp(argv[i], "--partial") == 0) {
            no_partial = false;
        } else if (strcmp(argv[i], "--help") == 0) {
            print_usage(argv[0]);
            return 0;
        }
    }

    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    fprintf(stderr, "mk3-screen-daemon: starting (src=%dx%d, fps=%d)\n", src_w, src_h, fps);

    // Open MK3 display-only
    mk3_t* dev = mk3_open_display();
    if (!dev) {
        fprintf(stderr, "Failed to open MK3 display. Retrying...\n");
        while (g_running && !dev) {
            sleep(1);
            dev = mk3_open_display();
        }
        if (!dev) return 1;
    }

    mk3_display_disable_partial_rendering(dev, no_partial);

    // Show splash screen
    uint16_t* splash = calloc(MK3_SCREEN_W * MK3_SCREEN_H, sizeof(uint16_t));
    if (splash) {
        // Dark blue background
        for (int i = 0; i < MK3_SCREEN_W * MK3_SCREEN_H; i++) {
            splash[i] = xrgb8888_to_rgb565(0, 0, 40);
        }
        mk3_display_draw(dev, 0, splash);
        mk3_display_draw(dev, 1, splash);
        free(splash);
    }

    // Open capture
    capture_ctx_t* cap = capture_open(src_w, src_h);
    if (!cap) {
        fprintf(stderr, "Failed to open capture device\n");
        mk3_close_display(dev);
        return 1;
    }

    uint16_t* screen_buf = calloc(MK3_SCREEN_W * MK3_SCREEN_H, sizeof(uint16_t));
    if (!screen_buf) {
        capture_close(cap);
        mk3_close_display(dev);
        return 1;
    }

    long frame_interval_ns = 1000000000L / fps;
    struct timespec ts_start, ts_end;
    int consecutive_failures = 0;

    // Main loop
    while (g_running) {
        clock_gettime(CLOCK_MONOTONIC, &ts_start);

        const uint8_t* frame = capture_frame(cap);
        if (!frame) {
            consecutive_failures++;
            if (consecutive_failures > 10) {
                fprintf(stderr, "Too many capture failures, exiting\n");
                break;
            }
            usleep(100000);
            continue;
        }
        consecutive_failures = 0;

        int bpp = capture_bpp(cap);
        int stride = src_w * bpp;
        int half_w = src_w / 2;

        // Left screen = left half of source
        scale_region_to_screen(frame, 0, 0, half_w, src_h, stride, bpp, screen_buf);
        int res_left = mk3_display_draw(dev, 0, screen_buf);

        // Right screen = right half of source
        scale_region_to_screen(frame, half_w, 0, half_w, src_h, stride, bpp, screen_buf);
        int res_right = mk3_display_draw(dev, 1, screen_buf);

        if (res_left != 0 || res_right != 0) {
            consecutive_failures++;
            if (consecutive_failures > 10) {
                fprintf(stderr, "Display write failures, reconnecting...\n");
                mk3_close_display(dev);
                dev = NULL;
                while (g_running && !dev) {
                    sleep(1);
                    dev = mk3_open_display();
                }
                if (dev) {
                    mk3_display_disable_partial_rendering(dev, no_partial);
                    consecutive_failures = 0;
                }
            }
        } else {
            consecutive_failures = 0;
        }

        // Frame rate limiting
        clock_gettime(CLOCK_MONOTONIC, &ts_end);
        long elapsed_ns = (ts_end.tv_sec - ts_start.tv_sec) * 1000000000L
                        + (ts_end.tv_nsec - ts_start.tv_nsec);
        long sleep_ns = frame_interval_ns - elapsed_ns;
        if (sleep_ns > 0) {
            struct timespec ts_sleep = {
                .tv_sec = sleep_ns / 1000000000L,
                .tv_nsec = sleep_ns % 1000000000L,
            };
            nanosleep(&ts_sleep, NULL);
        }
    }

    fprintf(stderr, "mk3-screen-daemon: shutting down\n");
    free(screen_buf);
    capture_close(cap);
    if (dev) {
        // Clear screens on shutdown
        mk3_display_clear(dev, 0, 0x0000);
        mk3_display_clear(dev, 1, 0x0000);
        mk3_close_display(dev);
    }

    return 0;
}
```

- [ ] **Step 4: Create `screen-daemon/CMakeLists.txt`**

```cmake
add_executable(mk3-screen-daemon
    main.c
    capture_linuxfb.c
)

set_target_properties(mk3-screen-daemon PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
)

target_include_directories(mk3-screen-daemon PRIVATE
    ${CMAKE_SOURCE_DIR}/external/mk3
)

target_link_libraries(mk3-screen-daemon PRIVATE mk3)
```

- [ ] **Step 5: Add screen-daemon to root CMakeLists.txt**

Add this line to `CMakeLists.txt`:
```cmake
add_subdirectory(screen-daemon)
```

- [ ] **Step 6: Build and verify**

```bash
cd /home/zeb/dev/mixx-mk3/build && cmake .. && cmake --build .
```

Expected: Compiles `mk3-screen-daemon` binary.

- [ ] **Step 7: Commit**

```bash
git add screen-daemon/ CMakeLists.txt
git commit -m "feat(screen-daemon): add linuxfb capture and screen mirroring daemon

Captures /dev/fb0, splits left/right, downscales to 480x272,
sends to MK3 screens via mk3_open_display(). Includes signal
handling, reconnect logic, and splash screen."
```

---

### Task 10: Add DRM capture backend

Add the DRM/KMS plane capture backend for GPU-rendered content. This is the primary capture path on Raspberry Pi OS Bookworm.

**Files:**
- Create: `screen-daemon/capture_drm.c`
- Modify: `screen-daemon/CMakeLists.txt`
- Modify: `screen-daemon/main.c`

- [ ] **Step 1: Create `screen-daemon/capture_drm.c`**

```c
#include "capture.h"
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>
#include <xf86drm.h>
#include <xf86drmMode.h>

struct capture_ctx {
    int drm_fd;
    int width;
    int height;
    int bpp;
    uint8_t* mapped;
    size_t mapped_size;
    int dma_buf_fd;
    uint32_t fb_id;
};

capture_ctx_t* capture_open(int width, int height) {
    capture_ctx_t* ctx = calloc(1, sizeof(capture_ctx_t));
    if (!ctx) return NULL;

    ctx->width = width;
    ctx->height = height;
    ctx->bpp = 4;  // XRGB8888
    ctx->dma_buf_fd = -1;
    ctx->mapped = MAP_FAILED;

    ctx->drm_fd = open("/dev/dri/card0", O_RDWR);
    if (ctx->drm_fd < 0) {
        // Try card1 (Pi 4 sometimes uses this)
        ctx->drm_fd = open("/dev/dri/card1", O_RDWR);
        if (ctx->drm_fd < 0) {
            perror("Failed to open DRM device");
            free(ctx);
            return NULL;
        }
    }

    // Enable universal planes to see all planes including primary
    drmSetClientCap(ctx->drm_fd, DRM_CLIENT_CAP_UNIVERSAL_PLANES, 1);

    fprintf(stderr, "DRM capture: opened, looking for active plane...\n");
    return ctx;
}

const uint8_t* capture_frame(capture_ctx_t* ctx) {
    if (!ctx) return NULL;

    // Unmap previous frame if any
    if (ctx->mapped != MAP_FAILED && ctx->mapped != NULL) {
        munmap(ctx->mapped, ctx->mapped_size);
        ctx->mapped = MAP_FAILED;
    }
    if (ctx->dma_buf_fd >= 0) {
        close(ctx->dma_buf_fd);
        ctx->dma_buf_fd = -1;
    }

    // Find the active plane with a framebuffer
    drmModePlaneRes* planes = drmModeGetPlaneResources(ctx->drm_fd);
    if (!planes) return NULL;

    uint32_t fb_id = 0;
    for (uint32_t i = 0; i < planes->count_planes && fb_id == 0; i++) {
        drmModePlane* plane = drmModeGetPlane(ctx->drm_fd, planes->planes[i]);
        if (plane && plane->fb_id) {
            fb_id = plane->fb_id;
        }
        drmModeFreePlane(plane);
    }
    drmModeFreePlaneResources(planes);

    if (!fb_id) return NULL;

    // Get framebuffer info
    drmModeFB2* fb = drmModeGetFB2(ctx->drm_fd, fb_id);
    if (!fb) {
        // Fallback to FB1 API
        drmModeFB* fb1 = drmModeGetFB(ctx->drm_fd, fb_id);
        if (!fb1 || !fb1->handle) {
            if (fb1) drmModeFreeFB(fb1);
            return NULL;
        }

        // Export handle to DMA-BUF
        int prime_fd = -1;
        if (drmPrimeHandleToFD(ctx->drm_fd, fb1->handle, DRM_RDWR, &prime_fd) != 0) {
            drmModeFreeFB(fb1);
            return NULL;
        }

        ctx->dma_buf_fd = prime_fd;
        ctx->mapped_size = fb1->pitch * fb1->height;
        ctx->bpp = fb1->bpp / 8;
        drmModeFreeFB(fb1);
    } else {
        if (!fb->handles[0]) {
            drmModeFreeFB2(fb);
            return NULL;
        }

        int prime_fd = -1;
        if (drmPrimeHandleToFD(ctx->drm_fd, fb->handles[0], DRM_RDWR, &prime_fd) != 0) {
            drmModeFreeFB2(fb);
            return NULL;
        }

        ctx->dma_buf_fd = prime_fd;
        ctx->mapped_size = fb->pitches[0] * fb->height;
        ctx->bpp = 4;  // Assume XRGB8888
        drmModeFreeFB2(fb);
    }

    ctx->mapped = mmap(NULL, ctx->mapped_size, PROT_READ, MAP_SHARED, ctx->dma_buf_fd, 0);
    if (ctx->mapped == MAP_FAILED) {
        return NULL;
    }

    return ctx->mapped;
}

int capture_bpp(capture_ctx_t* ctx) {
    return ctx ? ctx->bpp : 0;
}

void capture_close(capture_ctx_t* ctx) {
    if (!ctx) return;
    if (ctx->mapped != MAP_FAILED && ctx->mapped != NULL) {
        munmap(ctx->mapped, ctx->mapped_size);
    }
    if (ctx->dma_buf_fd >= 0) close(ctx->dma_buf_fd);
    if (ctx->drm_fd >= 0) close(ctx->drm_fd);
    free(ctx);
}
```

- [ ] **Step 2: Update `screen-daemon/CMakeLists.txt` for backend selection**

Replace the CMakeLists.txt:

```cmake
find_package(PkgConfig REQUIRED)

option(USE_DRM_CAPTURE "Use DRM capture backend (requires libdrm)" ON)

add_executable(mk3-screen-daemon main.c)

if(USE_DRM_CAPTURE)
    pkg_check_modules(LIBDRM REQUIRED libdrm)
    target_sources(mk3-screen-daemon PRIVATE capture_drm.c)
    target_include_directories(mk3-screen-daemon PRIVATE ${LIBDRM_INCLUDE_DIRS})
    target_link_libraries(mk3-screen-daemon PRIVATE ${LIBDRM_LIBRARIES})
    target_compile_definitions(mk3-screen-daemon PRIVATE USE_DRM_CAPTURE)
else()
    target_sources(mk3-screen-daemon PRIVATE capture_linuxfb.c)
endif()

set_target_properties(mk3-screen-daemon PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
)

target_include_directories(mk3-screen-daemon PRIVATE
    ${CMAKE_SOURCE_DIR}/external/mk3
)

target_link_libraries(mk3-screen-daemon PRIVATE mk3)
```

- [ ] **Step 3: Note on capture backend selection**

The capture backend (DRM vs linuxfb) is selected at compile time via the `USE_DRM_CAPTURE` CMake option. There is no runtime `--capture` flag — rebuild with `-DUSE_DRM_CAPTURE=OFF` to switch to the linuxfb backend.

- [ ] **Step 4: Build and verify**

```bash
cd /home/zeb/dev/mixx-mk3/build && cmake .. -DUSE_DRM_CAPTURE=ON && cmake --build .
```

Expected: Compiles with DRM backend. Also verify linuxfb fallback:
```bash
cmake .. -DUSE_DRM_CAPTURE=OFF && cmake --build .
```

- [ ] **Step 5: Commit**

```bash
git add screen-daemon/
git commit -m "feat(screen-daemon): add DRM/KMS capture backend

Captures GPU-rendered content via DRM plane -> DMA-BUF -> mmap.
Compile-time backend selection via USE_DRM_CAPTURE CMake option."
```

---

### Task 11: Create Pi setup script and systemd units

Create the setup script, udev rules, and systemd service files for Raspberry Pi deployment.

**Files:**
- Create: `pi-setup/mk3-pi-setup.sh`
- Create: `pi-setup/99-mk3.rules`
- Create: `pi-setup/mixxx.service`
- Create: `pi-setup/mk3-screen-daemon.service`

- [ ] **Step 1: Create udev rule**

`pi-setup/99-mk3.rules`:
```
# Native Instruments Maschine MK3
SUBSYSTEM=="usb", ATTR{idVendor}=="17cc", ATTR{idProduct}=="1600", MODE="0660", GROUP="audio"
```

- [ ] **Step 2: Create Mixxx systemd service**

`pi-setup/mixxx.service`:
```ini
[Unit]
Description=Mixxx DJ Software
After=sound.target

[Service]
Type=simple
User=pi
# Use eglfs for GPU-accelerated rendering to DRM/KMS plane (required for DRM capture).
# Change to linuxfb if using the linuxfb capture backend (disables GPU waveforms).
Environment=QT_QPA_PLATFORM=eglfs
Environment=HOME=/home/pi
ExecStart=/usr/bin/mixxx --fullScreen
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 3: Create screen daemon systemd service**

`pi-setup/mk3-screen-daemon.service`:
```ini
[Unit]
Description=MK3 Screen Mirroring Daemon
After=mixxx.service
Requires=mixxx.service

[Service]
Type=simple
User=pi
ExecStart=/usr/local/bin/mk3-screen-daemon --resolution 960x544 --fps 30 --no-partial
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 4: Create setup script**

`pi-setup/mk3-pi-setup.sh`:
```bash
#!/bin/bash
set -euo pipefail

echo "=== MK3 Mixxx Pi Setup ==="

# Check we're on a Pi
if [ ! -f /boot/config.txt ] && [ ! -f /boot/firmware/config.txt ]; then
    echo "Warning: This doesn't look like a Raspberry Pi. Continuing anyway."
fi

BOOT_CONFIG="/boot/firmware/config.txt"
if [ ! -f "$BOOT_CONFIG" ]; then
    BOOT_CONFIG="/boot/config.txt"
fi

BOOT_CMDLINE="/boot/firmware/cmdline.txt"
if [ ! -f "$BOOT_CMDLINE" ]; then
    BOOT_CMDLINE="/boot/cmdline.txt"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Install dependencies
echo "--- Installing dependencies ---"
sudo apt-get update
sudo apt-get install -y \
    mixxx \
    libusb-1.0-0-dev \
    libdrm-dev \
    cmake \
    build-essential \
    pkg-config

# 2. Build screen daemon
echo "--- Building screen daemon ---"
cd "$PROJECT_DIR"
mkdir -p build && cd build
cmake .. -DUSE_DRM_CAPTURE=ON
cmake --build . --target mk3-screen-daemon
sudo cp mk3-screen-daemon /usr/local/bin/

# 3. Install HID mapping
echo "--- Installing MK3 controller mapping ---"
MIXXX_CONTROLLERS="/home/pi/.mixxx/controllers"
mkdir -p "$MIXXX_CONTROLLERS"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.xml" "$MIXXX_CONTROLLERS/"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.js" "$MIXXX_CONTROLLERS/"

# 4. Install udev rules
echo "--- Installing udev rules ---"
sudo cp "$SCRIPT_DIR/99-mk3.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules

# 5. Install systemd services
echo "--- Installing systemd services ---"
sudo cp "$SCRIPT_DIR/mixxx.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/mk3-screen-daemon.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mixxx.service
sudo systemctl enable mk3-screen-daemon.service

# 6. Configure display
echo "--- Configuring display ---"
if ! grep -q "hdmi_force_hotplug" "$BOOT_CONFIG"; then
    echo "hdmi_force_hotplug:0=1" | sudo tee -a "$BOOT_CONFIG"
fi

if ! grep -q "video=HDMI-A-1" "$BOOT_CMDLINE"; then
    sudo sed -i 's/$/ video=HDMI-A-1:960x544@30/' "$BOOT_CMDLINE"
fi

# 7. Add user to audio group
sudo usermod -aG audio pi

echo ""
echo "=== Setup complete ==="
echo "Reboot to start Mixxx with MK3 support."
echo "  sudo reboot"
```

- [ ] **Step 5: Make setup script executable**

```bash
chmod +x pi-setup/mk3-pi-setup.sh
```

- [ ] **Step 6: Commit**

```bash
git add pi-setup/
git commit -m "feat(pi-setup): add setup script, udev rules, and systemd services

Automates installation on Raspberry Pi OS Lite:
- Installs Mixxx and builds screen daemon
- Deploys HID mapping, udev rules, systemd units
- Configures headless display output"
```

---

### Task 12: Final build verification and initial commit

Verify the complete project builds, all files are in place, and create the initial tagged commit.

**Files:**
- No new files

- [ ] **Step 1: Clean build from scratch**

```bash
cd /home/zeb/dev/mixx-mk3 && rm -rf build && mkdir build && cd build && cmake .. && cmake --build .
```

Expected: Builds `libmk3.a`, `mk3_test`, `mk3_cli`, `mk3-screen-daemon` without errors.

- [ ] **Step 2: Verify all files exist**

```bash
ls -la /home/zeb/dev/mixx-mk3/mapping/Native-Instruments-Maschine-MK3.xml
ls -la /home/zeb/dev/mixx-mk3/mapping/Native-Instruments-Maschine-MK3.js
ls -la /home/zeb/dev/mixx-mk3/screen-daemon/main.c
ls -la /home/zeb/dev/mixx-mk3/screen-daemon/capture_linuxfb.c
ls -la /home/zeb/dev/mixx-mk3/screen-daemon/capture_drm.c
ls -la /home/zeb/dev/mixx-mk3/pi-setup/mk3-pi-setup.sh
```

- [ ] **Step 3: Commit any remaining changes**

```bash
git status
git add -A
git commit -m "chore: Phase 1 complete — MK3 Mixxx standalone DJ unit

Includes:
- libmk3 display-only open (mk3_open_display)
- Mixxx HID mapping with transport, EQ, pads, LED feedback
- Screen mirroring daemon (DRM + linuxfb backends)
- Raspberry Pi setup automation"
```
