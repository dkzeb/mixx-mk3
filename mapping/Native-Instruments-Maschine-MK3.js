// Native Instruments Maschine MK3 — Mixxx HID Controller Mapping
// Two-deck DJ control: transport, EQ, pads (hotcues/loops/sampler/effects), LED feedback.
//
// Ported from libmk3 (external/mk3/) hardware definitions.
// Reference: Kontrol S4 Mk3 mapping in the Mixxx codebase for controller.send() usage.
//
// eslint-disable-next-line no-var
var MaschineMK3 = {};

// ---------------------------------------------------------------------------
// Button map: name -> [byteAddr, bitmask]
// Byte addresses are the indices into the Report ID 0x01 HID input packet
// (data[0] = report ID, data[1] = byte addr 0x01, ...).
// ---------------------------------------------------------------------------
MaschineMK3.buttons = {
    // 0x01
    "navPush":            [0x01, 0x01],
    "pedalConnected":     [0x01, 0x02],
    "navUp":              [0x01, 0x04],
    "navRight":           [0x01, 0x08],
    "navDown":            [0x01, 0x10],
    "navLeft":            [0x01, 0x20],
    "shift":              [0x01, 0x40],
    "d8":                 [0x01, 0x80],
    // 0x02
    "g1":                 [0x02, 0x01],
    "g2":                 [0x02, 0x02],
    "g3":                 [0x02, 0x04],
    "g4":                 [0x02, 0x08],
    "g5":                 [0x02, 0x10],
    "g6":                 [0x02, 0x20],
    "g7":                 [0x02, 0x40],
    "g8":                 [0x02, 0x80],
    // 0x03
    "notes":              [0x03, 0x01],
    "volume":             [0x03, 0x02],
    "swing":              [0x03, 0x04],
    "tempo":              [0x03, 0x08],
    "noteRepeatArp":      [0x03, 0x10],
    "lock":               [0x03, 0x20],
    // 0x04
    "padMode":            [0x04, 0x01],
    "keyboard":           [0x04, 0x02],
    "chords":             [0x04, 0x04],
    "step":               [0x04, 0x08],
    "fixedVel":           [0x04, 0x10],
    "scene":              [0x04, 0x20],
    "pattern":            [0x04, 0x40],
    "events":             [0x04, 0x80],
    // 0x05
    "microphoneConnected":[0x05, 0x01],
    "variationNavigate":  [0x05, 0x02],
    "duplicateDouble":    [0x05, 0x04],
    "select":             [0x05, 0x08],
    "solo":               [0x05, 0x10],
    "muteChoke":          [0x05, 0x20],
    "pitch":              [0x05, 0x40],
    "mod":                [0x05, 0x80],
    // 0x06
    "performFxSelect":    [0x06, 0x01],
    "restartLoop":        [0x06, 0x02],
    "eraseReplace":       [0x06, 0x04],
    "tapMetro":           [0x06, 0x08],
    "followGrid":         [0x06, 0x10],
    "play":               [0x06, 0x20],
    "recCountIn":         [0x06, 0x40],
    "stop":               [0x06, 0x80],
    // 0x07
    "macroSet":           [0x07, 0x01],
    "settings":           [0x07, 0x02],
    "arrowRight":         [0x07, 0x04],
    "sampling":           [0x07, 0x08],
    "mixer":              [0x07, 0x10],
    "plugin":             [0x07, 0x20],
    // 0x08
    "channelMidi":        [0x08, 0x01],
    "arranger":           [0x08, 0x02],
    "browserPlugin":      [0x08, 0x04],
    "arrowLeft":          [0x08, 0x08],
    "fileSave":           [0x08, 0x10],
    "auto":               [0x08, 0x20],
    // 0x09
    "d1":                 [0x09, 0x01],
    "d2":                 [0x09, 0x02],
    "d3":                 [0x09, 0x04],
    "d4":                 [0x09, 0x08],
    "d5":                 [0x09, 0x10],
    "d6":                 [0x09, 0x20],
    "d7":                 [0x09, 0x40],
    "navTouch":           [0x09, 0x80],
    // 0x0A — knob touch sensors
    "knobTouch8":         [0x0A, 0x01],
    "knobTouch7":         [0x0A, 0x02],
    "knobTouch6":         [0x0A, 0x04],
    "knobTouch5":         [0x0A, 0x08],
    "knobTouch4":         [0x0A, 0x10],
    "knobTouch3":         [0x0A, 0x20],
    "knobTouch2":         [0x0A, 0x40],
    "knobTouch1":         [0x0A, 0x80]
};

// ---------------------------------------------------------------------------
// Pad hardware-to-physical index map.
// HW index comes from the pad report (0-15). Physical number is 1-16, laid out:
//   1  2  3  4   (top row)
//   5  6  7  8
//   9 10 11 12
//  13 14 15 16   (bottom row)
// ---------------------------------------------------------------------------
MaschineMK3.padHwToPhysical = [13, 14, 15, 16, 9, 10, 11, 12, 5, 6, 7, 8, 1, 2, 3, 4];

// ---------------------------------------------------------------------------
// Knob descriptors: name -> [lsbAddr, msbAddr]
// Addresses are byte indices within the Report ID 0x01 packet.
// ---------------------------------------------------------------------------
MaschineMK3.knobs = {
    "k1":              [12, 13],
    "k2":              [14, 15],
    "k3":              [16, 17],
    "k4":              [18, 19],
    "k5":              [20, 21],
    "k6":              [22, 23],
    "k7":              [24, 25],
    "k8":              [26, 27],
    "micInGain":       [36, 37],
    "headphoneVolume": [38, 39],
    "masterVolume":    [40, 41]
};

// ---------------------------------------------------------------------------
// Input packet constants
// ---------------------------------------------------------------------------
MaschineMK3.STEPPER_ADDR        = 11;   // Byte index of the stepper (nav wheel) in report 0x01
MaschineMK3.PAD_REPORT_ID       = 0x02;
MaschineMK3.PAD_PRESSURE_THRESHOLD = 256;
MaschineMK3.PAD_DATA_START      = 1;    // Byte index where pad entries begin in pad report
MaschineMK3.PAD_ENTRY_LENGTH    = 3;    // Bytes per pad entry: [hwIndex, pressureLSB, pressureMSB]
MaschineMK3.PAD_MAX_ENTRIES     = 21;
MaschineMK3.PAD_COUNT           = 16;

// ---------------------------------------------------------------------------
// LED map: name -> [reportId, byteAddr]
// byteAddr is the 1-based index into the data portion of the HID output report.
// Report 0x80 length: 63 bytes.  Report 0x81 length: 42 bytes.
// ---------------------------------------------------------------------------
MaschineMK3.leds = {
    // Report 0x80 — mono (brightness 0-63)
    "channelMidi":      [0x80,  1],
    "plugin":           [0x80,  2],
    "arranger":         [0x80,  3],
    "browserPlugin":    [0x80,  5],
    "mixer":            [0x80,  4],
    "arrowLeft":        [0x80,  7],
    "arrowRight":       [0x80,  8],
    "fileSave":         [0x80,  9],
    "settings":         [0x80, 10],
    "auto":             [0x80, 11],
    "macroSet":         [0x80, 12],
    "d1":               [0x80, 13],
    "d2":               [0x80, 14],
    "d3":               [0x80, 15],
    "d4":               [0x80, 16],
    "d5":               [0x80, 17],
    "d6":               [0x80, 18],
    "d7":               [0x80, 19],
    "d8":               [0x80, 20],
    "volume":           [0x80, 21],
    "swing":            [0x80, 22],
    "noteRepeatArp":    [0x80, 23],
    "tempo":            [0x80, 24],
    "lock":             [0x80, 25],
    "pitch":            [0x80, 26],
    "mod":              [0x80, 27],
    "performFxSelect":  [0x80, 28],
    "notes":            [0x80, 29],
    "restartLoop":      [0x80, 38],
    "eraseReplace":     [0x80, 39],
    "tapMetro":         [0x80, 40],
    "followGrid":       [0x80, 41],
    "play":             [0x80, 42],
    "recCountIn":       [0x80, 43],
    "stop":             [0x80, 44],
    "shift":            [0x80, 45],
    "fixedVel":         [0x80, 46],
    "padMode":          [0x80, 47],
    "keyboard":         [0x80, 48],
    "chords":           [0x80, 49],
    "step":             [0x80, 50],
    "scene":            [0x80, 51],
    "pattern":          [0x80, 52],
    "events":           [0x80, 53],
    "variationNavigate":[0x80, 54],
    "duplicateDouble":  [0x80, 55],
    "select":           [0x80, 56],
    "solo":             [0x80, 57],
    "muteChoke":        [0x80, 58],
    // Report 0x80 — indexed color (0-71 palette)
    "sampling":         [0x80,  6],
    "g1":               [0x80, 30],
    "g2":               [0x80, 31],
    "g3":               [0x80, 32],
    "g4":               [0x80, 33],
    "g5":               [0x80, 34],
    "g6":               [0x80, 35],
    "g7":               [0x80, 36],
    "g8":               [0x80, 37],
    "navUp":            [0x80, 59],
    "navLeft":          [0x80, 60],
    "navRight":         [0x80, 61],
    "navDown":          [0x80, 62],
    // Report 0x81 — indexed color, pad LEDs
    "p1":               [0x81, 26],
    "p2":               [0x81, 27],
    "p3":               [0x81, 28],
    "p4":               [0x81, 29],
    "p5":               [0x81, 30],
    "p6":               [0x81, 31],
    "p7":               [0x81, 32],
    "p8":               [0x81, 33],
    "p9":               [0x81, 34],
    "p10":              [0x81, 35],
    "p11":              [0x81, 36],
    "p12":              [0x81, 37],
    "p13":              [0x81, 38],
    "p14":              [0x81, 39],
    "p15":              [0x81, 40],
    "p16":              [0x81, 41]
};

// ---------------------------------------------------------------------------
// Color palette constants (indexed LED color values)
// ---------------------------------------------------------------------------
MaschineMK3.Color = {
    OFF:    0,
    RED:    4,
    ORANGE: 8,
    YELLOW: 16,
    GREEN:  20,
    CYAN:   32,
    BLUE:   40,
    PURPLE: 48,
    PINK:   56,
    WHITE:  68
};

// ---------------------------------------------------------------------------
// Output report buffers (mirrors the LED state sent to the device).
// Indices are 1-based (matching byteAddr in the LED map); index 0 = report ID.
// report80: 63 bytes of data  (report ID 0x80, total packet = 64 bytes)
// report81: 42 bytes of data  (report ID 0x81, total packet = 43 bytes)
// ---------------------------------------------------------------------------
MaschineMK3.report80 = new Array(64).fill(0);   // [0]=0x80, [1..63]=data
MaschineMK3.report81 = new Array(43).fill(0);   // [0]=0x81, [1..42]=data

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
// Touchstrip constants
MaschineMK3.TOUCHSTRIP_LEDS = 25;          // ts1-ts25
MaschineMK3.TOUCHSTRIP_ADDR = 30;          // byte offset in report 0x01 (16-bit LE, 0-1024)
MaschineMK3.touchstripTapTimes = [];        // timestamps for triple-tap detection
MaschineMK3.touchstripLastValue = -1;       // last raw touchstrip value
MaschineMK3.touchstripTouched = false;      // whether strip is being touched

MaschineMK3.shiftPressed  = false;
MaschineMK3.selectPressed = false;     // "select" button held = modifier for deck switching
MaschineMK3.activeDeck    = 1;         // 1 or 2 — which deck the browser loads to
MaschineMK3.libraryVisible = false;    // whether the library panel is shown
MaschineMK3.mixerVisible   = false;    // whether the mixer panel is shown
MaschineMK3.padMode       = "hotcues"; // "hotcues" | "loops" | "sampler" | "effects"
MaschineMK3.lastButtonState = {};      // name -> pressed bool, for edge detection
MaschineMK3.lastStepperPos  = -1;
MaschineMK3.lastKnobValue  = {};      // name -> last raw value, for delta tracking

// Loop sizes indexed by physical pad number within a deck (1-8)
MaschineMK3.loopSizes = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16];

// ---------------------------------------------------------------------------
// setLed — write a single LED value into the appropriate buffer and send.
// value: brightness (0-63) for mono LEDs, or color index (0-71) for indexed.
//
// controller.send(data, length, reportId) — matches the Kontrol S4 Mk3 usage
// in the Mixxx codebase where reportId is passed as the third argument and the
// data array does NOT include the report ID byte at index 0.
// ---------------------------------------------------------------------------
MaschineMK3.setLed = function(name, value) {
    var def = MaschineMK3.leds[name];
    if (!def) {
        return;
    }
    var reportId = def[0];
    var addr     = def[1];   // 1-based index into the data region

    if (reportId === 0x80) {
        MaschineMK3.report80[addr] = value;
        // Send the data region (bytes 1-63) to the device.
        // controller.send expects the payload without the report-ID prefix byte.
        controller.send(MaschineMK3.report80.slice(1), 63, 0x80);
    } else if (reportId === 0x81) {
        MaschineMK3.report81[addr] = value;
        controller.send(MaschineMK3.report81.slice(1), 42, 0x81);
    }
};

// ---------------------------------------------------------------------------
// updateModeLEDs — illuminate the active pad-mode group button (g1-g4), dim
// the rest.
// ---------------------------------------------------------------------------
MaschineMK3.updateModeLEDs = function() {
    var modes = ["hotcues", "loops", "sampler", "effects"];
    var keys  = ["g1", "g2", "g3", "g4"];
    for (var i = 0; i < modes.length; i++) {
        MaschineMK3.setLed(keys[i],
            MaschineMK3.padMode === modes[i]
                ? MaschineMK3.Color.WHITE
                : MaschineMK3.Color.OFF);
    }
};

// ---------------------------------------------------------------------------
// updateDeckLEDs — show active deck via select/arrowLeft/arrowRight LEDs.
// ---------------------------------------------------------------------------
MaschineMK3.updateDeckLEDs = function() {
    // arrowLeft = Deck A, arrowRight = Deck B
    // Use mono LEDs: brightness 63 = active, 0 = inactive
    MaschineMK3.setLed("arrowLeft",  MaschineMK3.activeDeck === 1 ? 63 : 0);
    MaschineMK3.setLed("arrowRight", MaschineMK3.activeDeck === 2 ? 63 : 0);
    MaschineMK3.setLed("select", 63);  // select always lit as a "deck" indicator

    // Update on-screen deck highlight bars
    engine.setValue("[Skin]", "active_deck_a", MaschineMK3.activeDeck === 1 ? 1 : 0);
    engine.setValue("[Skin]", "active_deck_b", MaschineMK3.activeDeck === 2 ? 1 : 0);

    // If any panel is open, move it to the new non-active side
    if (MaschineMK3.libraryVisible || MaschineMK3.mixerVisible) {
        MaschineMK3.updatePanels();
    }

    // Reconnect transport LEDs to follow new active deck
    MaschineMK3.connectTransportLEDs();
};

// ---------------------------------------------------------------------------
// updateLibrary — show/hide library on the non-active deck's screen.
// Library sits between Deck A and Deck B in the layout. When shown, the
// non-active deck hides and the library takes its 480x544 slot.
// ---------------------------------------------------------------------------
MaschineMK3.updateLibrary = function() {
    MaschineMK3.updatePanels();
};

// ---------------------------------------------------------------------------
// updatePanels — show/hide library or mixer on the non-active deck's screen.
// Only one panel can be visible at a time. Both replace the non-active deck.
// ---------------------------------------------------------------------------
MaschineMK3.updatePanels = function() {
    var showLib = MaschineMK3.libraryVisible;
    var showMix = MaschineMK3.mixerVisible;
    var anyPanel = showLib || showMix;

    engine.setValue("[Skin]", "show_library", showLib ? 1 : 0);
    engine.setValue("[Skin]", "show_mixer", showMix ? 1 : 0);

    // Hide the non-active deck when any panel is open
    engine.setValue("[Skin]", "hide_deck_a", (anyPanel && MaschineMK3.activeDeck === 2) ? 1 : 0);
    engine.setValue("[Skin]", "hide_deck_b", (anyPanel && MaschineMK3.activeDeck === 1) ? 1 : 0);

    MaschineMK3.setLed("browserPlugin", showLib ? 63 : 16);
    MaschineMK3.setLed("mixer", showMix ? 63 : 16);

    if (showLib) {
        engine.setValue("[Library]", "MoveFocusForward", 1);
        engine.setValue("[Library]", "MoveFocusForward", 0);
    }
};

// ---------------------------------------------------------------------------
// connectTransportLEDs — connect/reconnect transport LED feedback to the
// active deck. Called on init and when switching decks.
// ---------------------------------------------------------------------------
MaschineMK3.transportConnections = [];

MaschineMK3.connectTransportLEDs = function() {
    // Disconnect previous connections
    for (var i = 0; i < MaschineMK3.transportConnections.length; i++) {
        MaschineMK3.transportConnections[i].disconnect();
    }
    MaschineMK3.transportConnections = [];

    var ch = "[Channel" + MaschineMK3.activeDeck + "]";

    MaschineMK3.transportConnections.push(
        engine.makeConnection(ch, "play_indicator", function(value) {
            MaschineMK3.setLed("play", value ? 63 : 0);
        })
    );
    MaschineMK3.transportConnections.push(
        engine.makeConnection(ch, "sync_enabled", function(value) {
            MaschineMK3.setLed("restartLoop", value ? 63 : 0);
        })
    );
    MaschineMK3.transportConnections.push(
        engine.makeConnection(ch, "cue_indicator", function(value) {
            MaschineMK3.setLed("recCountIn", value ? 63 : 0);
        })
    );

    // Trigger immediate update
    MaschineMK3.setLed("play", engine.getValue(ch, "play_indicator") ? 63 : 0);
    MaschineMK3.setLed("restartLoop", engine.getValue(ch, "sync_enabled") ? 63 : 0);
    MaschineMK3.setLed("recCountIn", engine.getValue(ch, "cue_indicator") ? 63 : 0);
};

// ---------------------------------------------------------------------------
// updateTouchstripLEDs — visualize crossfader position on the 25-segment strip.
// Crossfader value: -1 (full left) to +1 (full right). Center = 0.
// ---------------------------------------------------------------------------
MaschineMK3.updateTouchstripLEDs = function() {
    var xfader = engine.getValue("[Master]", "crossfader"); // -1 to 1
    // Map to 0-24 (LED index)
    var pos = Math.round(((xfader + 1.0) / 2.0) * 24);
    var C = MaschineMK3.Color;

    for (var i = 0; i < 25; i++) {
        var ledName = "ts" + (i + 1);
        if (i === pos) {
            MaschineMK3.setLed(ledName, C.WHITE);
        } else if (i === 12) {
            // Dim center marker
            MaschineMK3.setLed(ledName, C.BLUE);
        } else {
            MaschineMK3.setLed(ledName, C.OFF);
        }
    }
};

// ---------------------------------------------------------------------------
// processTouchstrip — parse touchstrip from HID report and map to crossfader.
// Called from parseReport01. Bytes 28-29 are suspected position (16-bit LE).
// ---------------------------------------------------------------------------
MaschineMK3.processTouchstrip = function(data) {
    // Touchstrip per ni config.json: dataLsb=30, dataMsb=31, range 0-1024, 0=released
    var raw = ((data[31] || 0) << 8) | (data[30] || 0);
    var touching = raw > 0;
    var wasTouching = MaschineMK3.touchstripTouched;

    // Visual debug: light up shift LED proportional to touchstrip value
    if (touching) {
        var brightness = Math.round((raw / 1024.0) * 63);
        MaschineMK3.setLed("shift", brightness);
    } else if (wasTouching && !touching) {
        MaschineMK3.setLed("shift", 0);
    }

    // Triple-tap detection (3 touches within 800ms → reset crossfader)
    if (touching && !wasTouching) {
        var now = Date.now();
        MaschineMK3.touchstripTapTimes.push(now);
        while (MaschineMK3.touchstripTapTimes.length > 0 &&
               now - MaschineMK3.touchstripTapTimes[0] > 800) {
            MaschineMK3.touchstripTapTimes.shift();
        }
        if (MaschineMK3.touchstripTapTimes.length >= 3) {
            engine.setValue("[Master]", "crossfader", 0);
            MaschineMK3.updateTouchstripLEDs();
            MaschineMK3.touchstripTapTimes = [];
        }
    }

    // Map position to crossfader (-1 to +1)
    if (touching && raw !== MaschineMK3.touchstripLastValue) {
        var norm = Math.max(0, Math.min(1, raw / 1024.0));
        var xfader = (norm * 2.0) - 1.0;
        engine.setValue("[Master]", "crossfader", xfader);
    }

    MaschineMK3.touchstripTouched = touching;
    MaschineMK3.touchstripLastValue = raw;
};

// ---------------------------------------------------------------------------
// setMode — switch pad mode and refresh mode LEDs + pad LEDs.
// ---------------------------------------------------------------------------
MaschineMK3.setMode = function(mode) {
    MaschineMK3.padMode = mode;
    MaschineMK3.updateModeLEDs();
    MaschineMK3.updatePadLEDs();
};

// ---------------------------------------------------------------------------
// updatePadLEDs — set pad LED colours based on current mode and deck state.
// Pads 1-8 = Deck A, pads 9-16 = Deck B.
// ---------------------------------------------------------------------------
MaschineMK3.updatePadLEDs = function() {
    var C = MaschineMK3.Color;
    var mode = MaschineMK3.padMode;

    for (var pad = 1; pad <= 16; pad++) {
        var ledName = "p" + pad;
        var isDeckA = pad <= 8;
        var ch      = isDeckA ? "[Channel1]" : "[Channel2]";
        var padIdx  = isDeckA ? pad : pad - 8;
        var color   = C.OFF;

        if (mode === "hotcues") {
            // Lit if hotcue is set
            var hcActive = engine.getValue(ch, "hotcue_" + padIdx + "_enabled");
            color = hcActive ? C.YELLOW : C.OFF;
        } else if (mode === "loops") {
            color = C.GREEN;
        } else if (mode === "sampler") {
            var loaded = engine.getValue(ch, "track_loaded");
            color = loaded ? C.BLUE : C.CYAN;
        } else if (mode === "effects") {
            // pads 1-3 / 9-11: FX params; pad 4/12: unit enable
            if (padIdx <= 3) {
                var fxUnit = isDeckA ? "[EffectRack1_EffectUnit1]" : "[EffectRack1_EffectUnit2]";
                var fxOn   = engine.getValue(fxUnit, "parameter" + padIdx);
                color = fxOn ? C.PURPLE : C.OFF;
            } else if (padIdx === 4) {
                var fxUnitEn = isDeckA ? "[EffectRack1_EffectUnit1]" : "[EffectRack1_EffectUnit2]";
                var enabled  = engine.getValue(fxUnitEn, "enabled");
                color = enabled ? C.RED : C.OFF;
            }
        }

        MaschineMK3.setLed(ledName, color);
    }
};

// ---------------------------------------------------------------------------
// onButtonPress — called for each detected button press edge.
// ---------------------------------------------------------------------------
MaschineMK3.onButtonPress = function(name) {
    var ch = "[Channel" + MaschineMK3.activeDeck + "]";

    switch (name) {
    // --- Transport: follows active deck ---
    case "play":
        engine.setValue(ch, "play", !engine.getValue(ch, "play"));
        break;
    case "stop":
        engine.setValue(ch, "stop", 1);
        break;
    case "recCountIn":
        engine.setValue(ch, "cue_default", 1);
        break;
    case "restartLoop":
        engine.setValue(ch, "sync_enabled",
            engine.getValue(ch, "sync_enabled") ? 0 : 1);
        break;

    // --- Modifier ---
    case "shift":
        MaschineMK3.shiftPressed = true;
        break;

    // --- Pad mode selection ---
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

    // --- D buttons: per-deck controls (D1-D4 = Deck A, D5-D8 = Deck B) ---
    // D1/D5: Sync
    case "d1":
        engine.setValue("[Channel1]", "sync_enabled",
            engine.getValue("[Channel1]", "sync_enabled") ? 0 : 1);
        break;
    case "d5":
        engine.setValue("[Channel2]", "sync_enabled",
            engine.getValue("[Channel2]", "sync_enabled") ? 0 : 1);
        break;
    // D2/D6: Tempo nudge down (momentary)
    case "d2":
        engine.setValue("[Channel1]", "rate_temp_down", 1);
        break;
    case "d6":
        engine.setValue("[Channel2]", "rate_temp_down", 1);
        break;
    // D3/D7: Tempo nudge up (momentary)
    case "d3":
        engine.setValue("[Channel1]", "rate_temp_up", 1);
        break;
    case "d7":
        engine.setValue("[Channel2]", "rate_temp_up", 1);
        break;
    // D4/D8: available

    // --- Deck select: arrow left/right ---
    case "arrowLeft":
        MaschineMK3.activeDeck = 1;
        MaschineMK3.updateDeckLEDs();
        break;
    case "arrowRight":
        MaschineMK3.activeDeck = 2;
        MaschineMK3.updateDeckLEDs();
        break;

    // --- Browser: toggle library panel on the non-active deck's screen ---
    case "browserPlugin":
        MaschineMK3.libraryVisible = !MaschineMK3.libraryVisible;
        if (MaschineMK3.libraryVisible) { MaschineMK3.mixerVisible = false; }
        MaschineMK3.updatePanels();
        break;

    // --- Mixer: toggle mixer panel ---
    case "mixer":
        MaschineMK3.mixerVisible = !MaschineMK3.mixerVisible;
        if (MaschineMK3.mixerVisible) { MaschineMK3.libraryVisible = false; }
        MaschineMK3.updatePanels();
        break;

    // --- Library navigation (4D encoder) ---
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
        if (MaschineMK3.libraryVisible) {
            // Load selected track to the active deck and close library
            engine.setValue("[Channel" + MaschineMK3.activeDeck + "]", "LoadSelectedTrack", 1);
            MaschineMK3.libraryVisible = false;
            MaschineMK3.updateLibrary();
        }
        break;
    }
};

// ---------------------------------------------------------------------------
// onButtonRelease — called for each detected button release edge.
// ---------------------------------------------------------------------------
MaschineMK3.onButtonRelease = function(name) {
    switch (name) {
    case "shift":
        MaschineMK3.shiftPressed = false;
        break;
    case "browserPlugin":
        break;
    // Cue is momentary — release resets the control
    case "recCountIn":
        engine.setValue("[Channel" + MaschineMK3.activeDeck + "]", "cue_default", 0);
        break;
    // D button releases — tempo nudge (momentary)
    case "d2":
        engine.setValue("[Channel1]", "rate_temp_down", 0);
        break;
    case "d3":
        engine.setValue("[Channel1]", "rate_temp_up", 0);
        break;
    case "d6":
        engine.setValue("[Channel2]", "rate_temp_down", 0);
        break;
    case "d7":
        engine.setValue("[Channel2]", "rate_temp_up", 0);
        break;
    // Library nav pulses
    case "navUp":
        engine.setValue("[Library]", "MoveUp", 0);
        break;
    case "navDown":
        engine.setValue("[Library]", "MoveDown", 0);
        break;
    case "navLeft":
        engine.setValue("[Library]", "MoveFocusBackward", 0);
        break;
    case "navRight":
        engine.setValue("[Library]", "MoveFocusForward", 0);
        break;
    case "navPush":
        engine.setValue("[Library]", "GoToItem", 0);
        break;
    }
};

// ---------------------------------------------------------------------------
// onKnobChange — called when an absolute knob value changes.
// value: raw 12-bit unsigned (0-4095).
// ---------------------------------------------------------------------------
// Helper: adjust a Mixxx control by delta, clamped to [min, max]
MaschineMK3.adjustValue = function(group, key, delta, sensitivity, min, max) {
    var current = engine.getValue(group, key);
    var newVal = Math.max(min, Math.min(max, current + (delta * sensitivity)));
    engine.setValue(group, key, newVal);
};

MaschineMK3.onKnobChange = function(name, value) {
    // K1-K8 are endless encoders — compute delta from last value
    var delta = 0;
    if (MaschineMK3.lastKnobValue[name] !== undefined) {
        delta = value - MaschineMK3.lastKnobValue[name];
        // Handle 16-bit wraparound
        if (delta > 2048) { delta -= 4096; }
        if (delta < -2048) { delta += 4096; }
    }
    MaschineMK3.lastKnobValue[name] = value;
    if (delta === 0) { return; }

    switch (name) {
    // --- K1-K4: Deck A ---
    case "k1": // Tempo rate (-1 to 1, 0 = normal)
        MaschineMK3.adjustValue("[Channel1]", "rate", delta, 0.002, -1, 1);
        break;
    case "k2": // Scrub/jog
        engine.setValue("[Channel1]", "jog", delta * 0.1);
        break;
    case "k3": // Volume (0 to 1)
        MaschineMK3.adjustValue("[Channel1]", "volume", delta, 0.002, 0, 1);
        break;
    case "k4": // Gain/pregain (0 to 4, 1 = unity)
        MaschineMK3.adjustValue("[Channel1]", "pregain", delta, 0.005, 0, 4);
        break;

    // --- K5-K8: Deck B ---
    case "k5": // Tempo rate
        MaschineMK3.adjustValue("[Channel2]", "rate", delta, 0.002, -1, 1);
        break;
    case "k6": // Scrub/jog
        engine.setValue("[Channel2]", "jog", delta * 0.1);
        break;
    case "k7": // Volume (0 to 1)
        MaschineMK3.adjustValue("[Channel2]", "volume", delta, 0.002, 0, 1);
        break;
    case "k8": // Gain/pregain (0 to 4, 1 = unity)
        MaschineMK3.adjustValue("[Channel2]", "pregain", delta, 0.005, 0, 4);
        break;

    // --- Physical pots (absolute, 0-4095) ---
    case "masterVolume":
        engine.setValue("[Master]", "gain", value / 4095.0);
        break;
    case "headphoneVolume":
        engine.setValue("[Master]", "headGain", value / 4095.0);
        break;
    }
};

// ---------------------------------------------------------------------------
// onStepperChange — nav wheel (stepper) turned.
// direction: positive = clockwise, negative = counter-clockwise.
// ---------------------------------------------------------------------------
MaschineMK3.onStepperChange = function(direction) {
    if (direction > 0) {
        engine.setValue("[Library]", "MoveDown", 1);
        engine.setValue("[Library]", "MoveDown", 0);
    } else {
        engine.setValue("[Library]", "MoveUp", 1);
        engine.setValue("[Library]", "MoveUp", 0);
    }
};

// ---------------------------------------------------------------------------
// onPadPress — called when a pad crosses the pressure threshold.
// padNumber: physical pad number (1-16).
// ---------------------------------------------------------------------------
MaschineMK3.onPadPress = function(padNumber) {
    var isDeckA = padNumber <= 8;
    var ch      = isDeckA ? "[Channel1]" : "[Channel2]";
    var padIdx  = isDeckA ? padNumber : padNumber - 8;
    var mode    = MaschineMK3.padMode;

    if (mode === "hotcues") {
        engine.setValue(ch, "hotcue_" + padIdx + "_activate", 1);

    } else if (mode === "loops") {
        var size = MaschineMK3.loopSizes[padIdx - 1];
        engine.setValue(ch, "beatloop_" + size + "_toggle", 1);

    } else if (mode === "sampler") {
        var loaded = engine.getValue(ch, "track_loaded");
        if (loaded) {
            engine.setValue(ch, "cue_gotoandplay", 1);
        } else {
            engine.setValue(ch, "LoadSelectedTrack", 1);
        }

    } else if (mode === "effects") {
        if (padIdx >= 1 && padIdx <= 3) {
            var fxUnit  = isDeckA ? "[EffectRack1_EffectUnit1]" : "[EffectRack1_EffectUnit2]";
            var current = engine.getValue(fxUnit, "parameter" + padIdx);
            engine.setValue(fxUnit, "parameter" + padIdx, current ? 0 : 1);
        } else if (padIdx === 4) {
            var fxUnitE  = isDeckA ? "[EffectRack1_EffectUnit1]" : "[EffectRack1_EffectUnit2]";
            var curEn    = engine.getValue(fxUnitE, "enabled");
            engine.setValue(fxUnitE, "enabled", curEn ? 0 : 1);
        }
        // Refresh pad LEDs after toggling effects
        MaschineMK3.updatePadLEDs();
    }
};

// ---------------------------------------------------------------------------
// onPadRelease — called when a pad drops below the pressure threshold.
// padNumber: physical pad number (1-16).
// ---------------------------------------------------------------------------
MaschineMK3.onPadRelease = function(padNumber) {
    var isDeckA = padNumber <= 8;
    var ch      = isDeckA ? "[Channel1]" : "[Channel2]";
    var padIdx  = isDeckA ? padNumber : padNumber - 8;
    var mode    = MaschineMK3.padMode;

    if (mode === "hotcues") {
        engine.setValue(ch, "hotcue_" + padIdx + "_activate", 0);
    }
};

// ---------------------------------------------------------------------------
// parseReport01 — parse a Report ID 0x01 packet (buttons, knobs, stepper).
// data: byte array from incomingData(), data[0] = report ID.
// ---------------------------------------------------------------------------
MaschineMK3.parseReport01 = function(data) {
    // --- Buttons (edge detection) ---
    var buttonNames = Object.keys(MaschineMK3.buttons);
    for (var i = 0; i < buttonNames.length; i++) {
        var name    = buttonNames[i];
        var def     = MaschineMK3.buttons[name];
        var byteIdx = def[0];   // 1-based address == index into data[]
        var mask    = def[1];
        var pressed = (data[byteIdx] & mask) !== 0;
        var wasDown = MaschineMK3.lastButtonState[name] || false;

        if (pressed && !wasDown) {
            MaschineMK3.onButtonPress(name);
        } else if (!pressed && wasDown) {
            MaschineMK3.onButtonRelease(name);
        }
        MaschineMK3.lastButtonState[name] = pressed;
    }

    // --- Stepper (nav wheel) ---
    var stepperPos = data[MaschineMK3.STEPPER_ADDR] & 0x0F;  // lower nibble, 0-15
    if (MaschineMK3.lastStepperPos >= 0) {
        var delta = stepperPos - MaschineMK3.lastStepperPos;
        // Handle 4-bit wraparound
        if (delta > 8)  { delta -= 16; }
        if (delta < -8) { delta += 16; }
        if (delta !== 0) {
            MaschineMK3.onStepperChange(delta);
        }
    }
    MaschineMK3.lastStepperPos = stepperPos;

    // --- Absolute knobs ---
    var knobNames = Object.keys(MaschineMK3.knobs);
    for (var j = 0; j < knobNames.length; j++) {
        var kName  = knobNames[j];
        var kDef   = MaschineMK3.knobs[kName];
        var lsb    = data[kDef[0]];
        var msb    = data[kDef[1]];
        var rawVal = (msb << 8) | lsb;
        // Clamp to 12-bit range
        if (rawVal > 4095) { rawVal = 4095; }
        MaschineMK3.onKnobChange(kName, rawVal);
    }

    // --- Touchstrip ---
    MaschineMK3.processTouchstrip(data);
};

// ---------------------------------------------------------------------------
// parseReport02 — parse a Report ID 0x02 packet (pad pressures).
// data: byte array from incomingData(), data[0] = report ID.
// ---------------------------------------------------------------------------
MaschineMK3.parseReport02 = function(data) {
    var start     = MaschineMK3.PAD_DATA_START;
    var entryLen  = MaschineMK3.PAD_ENTRY_LENGTH;
    var maxEnt    = MaschineMK3.PAD_MAX_ENTRIES;
    var threshold = MaschineMK3.PAD_PRESSURE_THRESHOLD;

    // Track current press state per physical pad to detect edges
    if (!MaschineMK3.padPressedState) {
        MaschineMK3.padPressedState = {};
    }

    // Mark all pads as not seen in this report; we will update below.
    // Only process pads that appear in the report (active touches).
    var seen = {};

    for (var e = 0; e < maxEnt; e++) {
        var base     = start + e * entryLen;
        if (base + 2 >= data.length) { break; }
        var hwIdx    = data[base];
        if (hwIdx >= MaschineMK3.PAD_COUNT) { break; }   // sentinel / end of list
        var pressLSB = data[base + 1];
        var pressMSB = data[base + 2];
        var pressure = (pressMSB << 8) | pressLSB;
        var physPad  = MaschineMK3.padHwToPhysical[hwIdx];

        seen[physPad] = true;
        var isDown    = pressure >= threshold;
        var wasDown2  = MaschineMK3.padPressedState[physPad] || false;

        if (isDown && !wasDown2) {
            MaschineMK3.padPressedState[physPad] = true;
            MaschineMK3.onPadPress(physPad);
        } else if (!isDown && wasDown2) {
            MaschineMK3.padPressedState[physPad] = false;
            MaschineMK3.onPadRelease(physPad);
        }
    }

    // Any pad not seen in this report and previously pressed is now released
    var padKeys = Object.keys(MaschineMK3.padPressedState);
    for (var k = 0; k < padKeys.length; k++) {
        var pp = parseInt(padKeys[k], 10);
        if (!seen[pp] && MaschineMK3.padPressedState[pp]) {
            MaschineMK3.padPressedState[pp] = false;
            MaschineMK3.onPadRelease(pp);
        }
    }
};

// ---------------------------------------------------------------------------
// incomingData — entry point called by Mixxx for every HID input report.
// ---------------------------------------------------------------------------
MaschineMK3.incomingData = function(data, length) {
    if (length < 1) { return; }
    var reportId = data[0];
    if (reportId === 0x01) {
        MaschineMK3.parseReport01(data);
    } else if (reportId === MaschineMK3.PAD_REPORT_ID) {
        MaschineMK3.parseReport02(data);
    } else {
        // Log unknown report IDs — touchstrip might be on a different report
        var hex = "";
        for (var i = 0; i < Math.min(length, 16); i++) {
            hex += ("0" + data[i].toString(16)).slice(-2) + " ";
        }
        print("MK3-UNKNOWN-REPORT: id=0x" + ("0" + reportId.toString(16)).slice(-2) +
              " len=" + length + " data=" + hex);
    }
};

// ---------------------------------------------------------------------------
// init — called by Mixxx when the mapping is loaded.
// ---------------------------------------------------------------------------
MaschineMK3.init = function(/* id, debugging */) {
    // Initialise output buffers with report ID at index 0
    MaschineMK3.report80[0] = 0x80;
    MaschineMK3.report81[0] = 0x81;

    // Blank all LEDs on startup
    controller.send(MaschineMK3.report80.slice(1), 63, 0x80);
    controller.send(MaschineMK3.report81.slice(1), 42, 0x81);

    // --- Transport LED feedback (follows active deck) ---
    MaschineMK3.connectTransportLEDs();

    // --- Hotcue LED feedback (refresh pad LEDs when hotcues change) ---
    for (var i = 1; i <= 8; i++) {
        (function(padIdx) {
            engine.connectControl("[Channel1]", "hotcue_" + padIdx + "_enabled",
                function() { MaschineMK3.updatePadLEDs(); });
            engine.connectControl("[Channel2]", "hotcue_" + padIdx + "_enabled",
                function() { MaschineMK3.updatePadLEDs(); });
        })(i);
    }

    // --- D button LED feedback (per-deck sync + play indicators) ---
    engine.makeConnection("[Channel1]", "sync_enabled", function(value) {
        MaschineMK3.setLed("d1", value ? 63 : 16);
    });
    engine.makeConnection("[Channel2]", "sync_enabled", function(value) {
        MaschineMK3.setLed("d5", value ? 63 : 16);
    });
    // Dim the nudge buttons (always available)
    MaschineMK3.setLed("d1", 16);
    MaschineMK3.setLed("d2", 16);
    MaschineMK3.setLed("d3", 16);
    MaschineMK3.setLed("d4", 16);
    MaschineMK3.setLed("d5", 16);
    MaschineMK3.setLed("d6", 16);
    MaschineMK3.setLed("d7", 16);
    MaschineMK3.setLed("d8", 16);

    // --- Crossfader → touchstrip LED feedback ---
    engine.makeConnection("[Master]", "crossfader", function() {
        MaschineMK3.updateTouchstripLEDs();
    });
    MaschineMK3.updateTouchstripLEDs();

    // --- Browser + Mixer + Settings LEDs (dim = available) ---
    MaschineMK3.setLed("browserPlugin", 16);
    MaschineMK3.setLed("mixer", 16);
    MaschineMK3.setLed("settings", 16);

    // --- Nav encoder LEDs (always dimly lit for navigation) ---
    MaschineMK3.setLed("navUp",    MaschineMK3.Color.WHITE);
    MaschineMK3.setLed("navDown",  MaschineMK3.Color.WHITE);
    MaschineMK3.setLed("navLeft",  MaschineMK3.Color.WHITE);
    MaschineMK3.setLed("navRight", MaschineMK3.Color.WHITE);

    // --- Reset EQs and filters to defaults (knobs send absolute values on init) ---
    for (var ch = 1; ch <= 2; ch++) {
        var chStr = "[Channel" + ch + "]";
        engine.setValue("[EqualizerRack1_" + chStr + "_Effect1]", "parameter1", 0.5);
        engine.setValue("[EqualizerRack1_" + chStr + "_Effect1]", "parameter2", 0.5);
        engine.setValue("[EqualizerRack1_" + chStr + "_Effect1]", "parameter3", 0.5);
        engine.setValue("[QuickEffectRack1_" + chStr + "]", "super1", 0.5);
        engine.setValue(chStr, "volume", 1.0);
        engine.setValue(chStr, "pregain", 1.0);
    }
    engine.setValue("[Master]", "gain", 1.0);
    engine.setValue("[Master]", "headGain", 1.0);

    // Set initial LED state
    MaschineMK3.updateModeLEDs();
    MaschineMK3.updatePadLEDs();
    MaschineMK3.updateDeckLEDs();
};

// ---------------------------------------------------------------------------
// shutdown — called by Mixxx when the mapping is unloaded.
// ---------------------------------------------------------------------------
MaschineMK3.shutdown = function() {
    // Blank all LEDs on shutdown
    for (var b = 1; b < MaschineMK3.report80.length; b++) {
        MaschineMK3.report80[b] = 0;
    }
    for (var c = 1; c < MaschineMK3.report81.length; c++) {
        MaschineMK3.report81[c] = 0;
    }
    controller.send(MaschineMK3.report80.slice(1), 63, 0x80);
    controller.send(MaschineMK3.report81.slice(1), 42, 0x81);
};
