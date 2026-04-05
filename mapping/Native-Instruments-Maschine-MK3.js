// Native Instruments Maschine MK3 — Mixxx HID Controller Mapping
// Two-deck DJ control: transport, EQ, pads (hotcues/loops/sampler/effects), LED feedback.
//
// Ported from libmk3 (external/mk3/) hardware definitions.
// Reference: Kontrol S4 Mk3 mapping in the Mixxx codebase for controller.send() usage.
//
// eslint-disable-next-line no-var
var MaschineMK3 = {};

// --- Tempo ramp configuration ---
var RAMP_BPM_PER_SEC = 2.0;
var RAMP_INTERVAL_MS = 50;
var RAMP_THRESHOLD_BPM = 0.05;
var RAMP_MULTIPLIERS = [1.0, 0.5, 2.0];
var RAMP_TARGET_STEP_THRESHOLD = 400;

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
//  13 14 15 16   (top row, furthest from you)
//   9 10 11 12
//   5  6  7  8
//   1  2  3  4   (bottom row, closest to you)
// ---------------------------------------------------------------------------
MaschineMK3.padHwToPhysical = [13, 14, 15, 16, 9, 10, 11, 12, 5, 6, 7, 8, 1, 2, 3, 4];

// LED names p1-p16 follow HW order (p1=top-left, p16=bottom-right),
// which is inverted from physical numbering. This maps physical → LED name.
MaschineMK3.padPhysicalToLed = {
    1: "p13", 2: "p14", 3: "p15", 4: "p16",   // bottom row
    5: "p9",  6: "p10", 7: "p11", 8: "p12",
    9: "p5", 10: "p6", 11: "p7", 12: "p8",
   13: "p1", 14: "p2", 15: "p3", 16: "p4"     // top row
};

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
    // Report 0x81 — indexed color, touchstrip LEDs
    "ts1":              [0x81,  1],
    "ts2":              [0x81,  2],
    "ts3":              [0x81,  3],
    "ts4":              [0x81,  4],
    "ts5":              [0x81,  5],
    "ts6":              [0x81,  6],
    "ts7":              [0x81,  7],
    "ts8":              [0x81,  8],
    "ts9":              [0x81,  9],
    "ts10":             [0x81, 10],
    "ts11":             [0x81, 11],
    "ts12":             [0x81, 12],
    "ts13":             [0x81, 13],
    "ts14":             [0x81, 14],
    "ts15":             [0x81, 15],
    "ts16":             [0x81, 16],
    "ts17":             [0x81, 17],
    "ts18":             [0x81, 18],
    "ts19":             [0x81, 19],
    "ts20":             [0x81, 20],
    "ts21":             [0x81, 21],
    "ts22":             [0x81, 22],
    "ts23":             [0x81, 23],
    "ts24":             [0x81, 24],
    "ts25":             [0x81, 25],
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
// rgbToPaletteIndex — map a Mixxx 32-bit RGB color to the nearest MK3 LED
// palette index (0-71). The MK3 palette has 18 hues x 4 brightness levels.
// We match on hue and return the brightest variant (base + 3).
// ---------------------------------------------------------------------------
MaschineMK3.rgbToPaletteIndex = function(rgb) {
    var r = (rgb >> 16) & 0xFF;
    var g = (rgb >> 8) & 0xFF;
    var b = rgb & 0xFF;

    // Default to white if color is black/zero
    if (r === 0 && g === 0 && b === 0) { return MaschineMK3.Color.WHITE; }

    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    if (max === 0) { return MaschineMK3.Color.WHITE; }

    var delta = max - min;
    if (delta === 0) { return MaschineMK3.Color.WHITE; } // grey

    var hue = 0;
    if (max === r) {
        hue = ((g - b) / delta) % 6;
    } else if (max === g) {
        hue = (b - r) / delta + 2;
    } else {
        hue = (r - g) / delta + 4;
    }
    hue = Math.round(hue * 60);
    if (hue < 0) { hue += 360; }

    var C = MaschineMK3.Color;
    if (hue < 15 || hue >= 345) { return C.RED; }
    if (hue < 45)  { return C.ORANGE; }
    if (hue < 75)  { return C.YELLOW; }
    if (hue < 150) { return C.GREEN; }
    if (hue < 195) { return C.CYAN; }
    if (hue < 255) { return C.BLUE; }
    if (hue < 300) { return C.PURPLE; }
    return C.PINK;
};

// ---------------------------------------------------------------------------
// updateStemLEDs — set G1-G8 LED color/brightness from stem state.
// Color = stem color mapped to palette. Brightness scaled by volume. Off when muted.
// ---------------------------------------------------------------------------
MaschineMK3.updateStemLEDs = function() {
    for (var deck = 1; deck <= 2; deck++) {
        // Check if this deck has stems loaded (stem_count > 0)
        var stemCount = engine.getValue("[Channel" + deck + "]", "stem_count");
        for (var stem = 1; stem <= 4; stem++) {
            var gName = "g" + ((deck - 1) * 4 + stem);
            if (!stemCount || stem > stemCount) {
                // No stems or stem index out of range — LED off
                MaschineMK3.setLed(gName, MaschineMK3.Color.OFF);
                continue;
            }
            var stemGroup = "[Channel" + deck + "_Stem" + stem + "]";
            var isMuted = engine.getValue(stemGroup, "mute");
            if (isMuted) {
                MaschineMK3.setLed(gName, MaschineMK3.Color.OFF);
            } else {
                var color = engine.getValue(stemGroup, "color");
                var paletteIdx = MaschineMK3.rgbToPaletteIndex(color);
                var volume = engine.getValue(stemGroup, "volume");
                // Palette has 4 brightness levels per hue (base+0=dimmest, base+3=brightest)
                var brightnessLevel = Math.round(volume * 3); // 0-3
                var ledValue = paletteIdx + brightnessLevel;
                if (volume > 0 && ledValue < 1) { ledValue = 1; }
                MaschineMK3.setLed(gName, ledValue);
            }
        }
    }
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
MaschineMK3.mouseMode     = false;     // mouse mode active (Auto+Macro combo)
MaschineMK3.autoPressed   = false;     // "auto" button held — enables knob snap-back
MaschineMK3.autoSnap      = {};        // knob name -> {group, key, value} saved on touch
MaschineMK3.activeDeck    = 1;         // 1 or 2 — which deck the browser loads to
MaschineMK3.libraryVisible  = false;    // whether the library panel is shown
MaschineMK3.sidebarVisible  = false;    // whether the library sidebar is shown
MaschineMK3.mixerVisible    = false;    // whether the mixer panel is shown
MaschineMK3.stemMixerVisible = false;   // whether the stem mixer panel is shown
MaschineMK3.tempoVisible = false;
MaschineMK3.tempoState = {
    rampTimerA: 0,
    rampTimerB: 0,
    rampMultiplierA: 0,
    rampMultiplierB: 0,
    rampTargetAccumA: 0,
    rampTargetAccumB: 0,
    rampLedTimer: 0,
    rampLedState: false,
};
MaschineMK3.overlayActive   = false;    // overlay widget has focus — suppress HID processing

MaschineMK3.padMode       = "cuepoints"; // "cuepoints" | "loops" | "effects" | "t9" — cuepoints is default
MaschineMK3.cueDisplayVisible = false;   // whether the cue point panel is shown on screen

// Library sidebar tab indices (fixed order in Mixxx)
MaschineMK3.LIBRARY_TABS = {
    "tracks":    0,
    "playlists": 2,
    "crates":    3,
    "prepare":   7
};
// D-button → tab mapping (only active when library is open)
// D1=Tracks, D3=Analyze all, D4=Rescan
MaschineMK3.libraryTabMap = {
    "d1": "tracks"
};
MaschineMK3.librarySidebarPos = 0;  // current sidebar index

// Effects pad mapping: pad number → {unit, slot} or {unit, "enable"}
// Layout (physical, bottom to top):
//   1: Echo       2: Reverb      3: Filter       4: Unit1 ON/OFF
//   5: MoogFilter 6: Compressor  7: WhiteNoise   8: Unit4 ON/OFF
//   9: Flanger   10: Phaser     11: Distortion  12: Unit2 ON/OFF
//  13: AutoPan   14: Glitch     15: PitchShift  16: Unit3 ON/OFF
MaschineMK3.fxPadMap = {
    1:  {unit: 1, slot: 1},  2:  {unit: 1, slot: 2},  3:  {unit: 1, slot: 3},
    4:  {unit: 1, enable: true},
    5:  {unit: 4, slot: 1},  6:  {unit: 4, slot: 2},  7:  {unit: 4, slot: 3},
    8:  {unit: 4, enable: true},
    9:  {unit: 2, slot: 1}, 10:  {unit: 2, slot: 2}, 11:  {unit: 2, slot: 3},
    12: {unit: 2, enable: true},
    13: {unit: 3, slot: 1}, 14:  {unit: 3, slot: 2}, 15:  {unit: 3, slot: 3},
    16: {unit: 3, enable: true}
};
MaschineMK3.lastButtonState = {};      // name -> pressed bool, for edge detection
MaschineMK3.lastStepperPos  = -1;
MaschineMK3.lastKnobValue  = {};      // name -> last raw value, for delta tracking

// Loop sizes for 16 pads
// Physical layout:  13 14 15 16    (top row, furthest from you)
//                    9 10 11 12
//                    5  6  7  8
//                    1  2  3  4    (bottom row, closest to you)
MaschineMK3.loopSizes = {
   13: 0.0625, 14: 0.125, 15: 0.25,  16: 0.5,
    9: 1,      10: 2,     11: 4,     12: 8,
    5: 16,      6: 32,     7: 64,     8: 128,
    1: -1,      2: -2,     3: -3,     4: -4   // negative = special actions
};
// Pad 1: loop halve, 2: loop double, 3: reloop/toggle, 4: loop out (exit)

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
    if (MaschineMK3.libraryVisible || MaschineMK3.mixerVisible || MaschineMK3.stemMixerVisible) {
        MaschineMK3.updatePanels();
    }

    // Reconnect transport LEDs to follow new active deck
    MaschineMK3.connectTransportLEDs();

    // Update pad LEDs to reflect the new deck's state
    MaschineMK3.updatePadLEDs();
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
// toggleTempoPanel — show/hide tempo panel on both screens.
// ---------------------------------------------------------------------------
MaschineMK3.toggleTempoPanel = function() {
    MaschineMK3.tempoVisible = !MaschineMK3.tempoVisible;
    if (MaschineMK3.tempoVisible) {
        MaschineMK3.libraryVisible = false;
        MaschineMK3.mixerVisible = false;
        MaschineMK3.stemMixerVisible = false;
        MaschineMK3.cueDisplayVisible = false;
        MaschineMK3.setLed("notes", 0);
        if (MaschineMK3.padMode === "t9") { MaschineMK3.padMode = "cuepoints"; }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
    }
    MaschineMK3.updateTempoLed();
    MaschineMK3.updatePanels();
    if (MaschineMK3.tempoVisible) {
        MaschineMK3.updateTempoDButtonLEDs();
        // Push current ramp target to skin
        engine.setValue("[Skin]", "ramp_target_a", MaschineMK3.tempoState.rampMultiplierA);
        engine.setValue("[Skin]", "ramp_target_b", MaschineMK3.tempoState.rampMultiplierB);
    }
};

// ---------------------------------------------------------------------------
// updateTempoLed — set TEMPO button LED based on panel and ramp state.
// ---------------------------------------------------------------------------
MaschineMK3.updateTempoLed = function() {
    var anyRamp = MaschineMK3.tempoState.rampTimerA || MaschineMK3.tempoState.rampTimerB;
    if (anyRamp) {
        return;
    }
    MaschineMK3.setLed("tempo", MaschineMK3.tempoVisible ? 63 : 16);
};

// ---------------------------------------------------------------------------
// updateTempoDButtonLEDs — set D-button LEDs for tempo panel state.
// ---------------------------------------------------------------------------
MaschineMK3.updateTempoDButtonLEDs = function() {
    if (!MaschineMK3.tempoVisible) { return; }
    MaschineMK3.setLed("d1", engine.getValue("[Channel1]", "sync_enabled") ? 63 : 16);
    MaschineMK3.setLed("d5", engine.getValue("[Channel2]", "sync_enabled") ? 63 : 16);
    MaschineMK3.setLed("d2", engine.getValue("[Channel1]", "keylock") ? 63 : 16);
    MaschineMK3.setLed("d6", engine.getValue("[Channel2]", "keylock") ? 63 : 16);
    MaschineMK3.setLed("d3", MaschineMK3.tempoState.rampTimerA ? 63 : 16);
    MaschineMK3.setLed("d7", MaschineMK3.tempoState.rampTimerB ? 63 : 16);
    MaschineMK3.setLed("d4", 16);
    MaschineMK3.setLed("d8", 16);
};

// ---------------------------------------------------------------------------
// handleRampTargetKnob — sticky knob for ramp target selection.
// Accumulates knob delta and steps through multipliers when threshold crossed.
// ---------------------------------------------------------------------------
MaschineMK3.handleRampTargetKnob = function(deck, delta) {
    var key = (deck === 1) ? "rampTargetAccumA" : "rampTargetAccumB";
    var mulKey = (deck === 1) ? "rampMultiplierA" : "rampMultiplierB";
    MaschineMK3.tempoState[key] += delta;

    var changed = false;
    if (MaschineMK3.tempoState[key] >= RAMP_TARGET_STEP_THRESHOLD) {
        MaschineMK3.tempoState[key] = 0;
        if (MaschineMK3.tempoState[mulKey] < RAMP_MULTIPLIERS.length - 1) {
            MaschineMK3.tempoState[mulKey]++;
            changed = true;
        }
    } else if (MaschineMK3.tempoState[key] <= -RAMP_TARGET_STEP_THRESHOLD) {
        MaschineMK3.tempoState[key] = 0;
        if (MaschineMK3.tempoState[mulKey] > 0) {
            MaschineMK3.tempoState[mulKey]--;
            changed = true;
        }
    }
    if (changed) {
        var skinKey = (deck === 1) ? "ramp_target_a" : "ramp_target_b";
        engine.setValue("[Skin]", skinKey, MaschineMK3.tempoState[mulKey]);
    }
};

// ---------------------------------------------------------------------------
// startRamp — begin ramping a deck toward the opposite deck's BPM × multiplier.
// ---------------------------------------------------------------------------
MaschineMK3.startRamp = function(deck) {
    var timerKey = (deck === 1) ? "rampTimerA" : "rampTimerB";

    // Disable sync on the ramping deck (sync would fight the ramp)
    engine.setValue("[Channel" + deck + "]", "sync_enabled", 0);

    MaschineMK3.tempoState[timerKey] = engine.beginTimer(RAMP_INTERVAL_MS, function() {
        MaschineMK3.rampTick(deck);
    });

    // Start LED pulse if not already running
    if (!MaschineMK3.tempoState.rampLedTimer) {
        MaschineMK3.tempoState.rampLedTimer = engine.beginTimer(500, function() {
            MaschineMK3.updateRampLed();
        });
    }

    // Show ramp indicator on deck screen
    engine.setValue("[Skin]", "show_ramp_" + (deck === 1 ? "a" : "b"), 1);

    // Update D-button LED
    MaschineMK3.setLed(deck === 1 ? "d3" : "d7", 63);
};

// ---------------------------------------------------------------------------
// stopRamp — stop ramping a deck. Cleans up timer, LED, indicators.
// ---------------------------------------------------------------------------
MaschineMK3.stopRamp = function(deck) {
    var timerKey = (deck === 1) ? "rampTimerA" : "rampTimerB";

    if (MaschineMK3.tempoState[timerKey]) {
        engine.stopTimer(MaschineMK3.tempoState[timerKey]);
        MaschineMK3.tempoState[timerKey] = 0;
    }

    // Hide ramp indicator on deck screen
    engine.setValue("[Skin]", "show_ramp_" + (deck === 1 ? "a" : "b"), 0);

    // Reset D-button LED
    MaschineMK3.setLed(deck === 1 ? "d3" : "d7", 16);

    // Stop LED pulse if no ramps active
    if (!MaschineMK3.tempoState.rampTimerA && !MaschineMK3.tempoState.rampTimerB) {
        if (MaschineMK3.tempoState.rampLedTimer) {
            engine.stopTimer(MaschineMK3.tempoState.rampLedTimer);
            MaschineMK3.tempoState.rampLedTimer = 0;
            MaschineMK3.tempoState.rampLedState = false;
        }
        MaschineMK3.updateTempoLed();
    }
};

// ---------------------------------------------------------------------------
// rampTick — called every RAMP_INTERVAL_MS. Adjusts rate toward target BPM.
// ---------------------------------------------------------------------------
MaschineMK3.rampTick = function(deck) {
    var channel = "[Channel" + deck + "]";
    var oppDeck = (deck === 1) ? 2 : 1;
    var oppChannel = "[Channel" + oppDeck + "]";
    var mulKey = (deck === 1) ? "rampMultiplierA" : "rampMultiplierB";
    var multiplier = RAMP_MULTIPLIERS[MaschineMK3.tempoState[mulKey]];

    var currentBpm = engine.getValue(channel, "bpm");
    var oppBpm = engine.getValue(oppChannel, "bpm");
    var targetBpm = oppBpm * multiplier;

    var diff = targetBpm - currentBpm;

    if (Math.abs(diff) <= RAMP_THRESHOLD_BPM) {
        MaschineMK3.stopRamp(deck);
        return;
    }

    var bpmPerTick = RAMP_BPM_PER_SEC * (RAMP_INTERVAL_MS / 1000.0);
    var step = (diff > 0) ? Math.min(bpmPerTick, diff) : Math.max(-bpmPerTick, diff);

    var fileBpm = engine.getValue(channel, "file_bpm");
    var rateRange = engine.getValue(channel, "rateRange");

    if (fileBpm <= 0 || rateRange <= 0) {
        MaschineMK3.stopRamp(deck);
        return;
    }

    var currentRate = engine.getValue(channel, "rate");
    var rateDelta = step / (fileBpm * rateRange * 2);
    var newRate = currentRate + rateDelta;

    if (newRate < -1) { newRate = -1; MaschineMK3.stopRamp(deck); }
    else if (newRate > 1) { newRate = 1; MaschineMK3.stopRamp(deck); }

    engine.setValue(channel, "rate", newRate);
};

// ---------------------------------------------------------------------------
// updateRampLed — pulse TEMPO button LED while any ramp is active.
// ---------------------------------------------------------------------------
MaschineMK3.updateRampLed = function() {
    MaschineMK3.tempoState.rampLedState = !MaschineMK3.tempoState.rampLedState;
    MaschineMK3.setLed("tempo", MaschineMK3.tempoState.rampLedState ? 63 : 16);
};

// ---------------------------------------------------------------------------
// updatePanels — show/hide library or mixer on the non-active deck's screen.
// Only one panel can be visible at a time. Both replace the non-active deck.
// ---------------------------------------------------------------------------
MaschineMK3.updatePanels = function() {
    var showLib = MaschineMK3.libraryVisible;
    var showMix = MaschineMK3.mixerVisible;
    var showStemMix = MaschineMK3.stemMixerVisible;
    var showTempo = MaschineMK3.tempoVisible;
    var noPanelOpen = !showLib && !showMix && !showStemMix && !showTempo;
    var showPadsLoops = noPanelOpen && MaschineMK3.padMode === "loops";
    var showPadsFx = noPanelOpen && MaschineMK3.padMode === "effects";
    var showPadsCues = noPanelOpen && MaschineMK3.cueDisplayVisible;
    var anyPanel = showLib || showMix || showStemMix || showTempo || showPadsLoops || showPadsFx || showPadsCues;

    engine.setValue("[Skin]", "show_library", showLib ? 1 : 0);
    engine.setValue("[Skin]", "show_mixer", showMix ? 1 : 0);
    engine.setValue("[Skin]", "show_stem_mixer", showStemMix ? 1 : 0);
    engine.setValue("[Skin]", "show_tempo", showTempo ? 1 : 0);
    engine.setValue("[Skin]", "show_t9", showLib ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_loops", showPadsLoops ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_fx", showPadsFx ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_cues", showPadsCues ? 1 : 0);

    if (showLib || showTempo) {
        // Library: always left screen, T9 pad overview: always right screen
        engine.setValue("[Skin]", "hide_deck_a", 1);
        engine.setValue("[Skin]", "hide_deck_b", 1);
    } else {
        // Other panels: replace non-active deck
        engine.setValue("[Skin]", "hide_deck_a", (anyPanel && MaschineMK3.activeDeck === 2) ? 1 : 0);
        engine.setValue("[Skin]", "hide_deck_b", (anyPanel && MaschineMK3.activeDeck === 1) ? 1 : 0);
    }

    MaschineMK3.setLed("browserPlugin", showLib ? 63 : 16);
    MaschineMK3.setLed("mixer", (showMix || showStemMix) ? 63 : 16);

    if (showLib) {
        // focused_widget: 0=none, 1=search bar, 2=sidebar, 3=track table
        engine.setValue("[Library]", "focused_widget", 1);
        MaschineMK3.updateLibraryTabLEDs();
    } else {
        // Restore D1-D4 LEDs to normal state
        MaschineMK3.setLed("d1", 0);
        MaschineMK3.setLed("d2", 0);
        MaschineMK3.setLed("d3", 0);
        MaschineMK3.setLed("d4", 0);
    }
};

// ---------------------------------------------------------------------------
// Library tab navigation — D1-D4 switch between sidebar features.
// ---------------------------------------------------------------------------
MaschineMK3.activeLibraryTab = "tracks";

MaschineMK3.selectLibraryTab = function(tabName) {
    var targetIdx = MaschineMK3.LIBRARY_TABS[tabName];
    if (targetIdx === undefined) { return; }
    // Navigate to top of sidebar first, then down to target
    engine.setValue("[Library]", "focused_widget", 2);
    engine.beginTimer(50, function() {
        // Go to top (large negative)
        engine.setValue("[Playlist]", "SelectPlaylist", -20);
        engine.beginTimer(50, function() {
            // Go down to target index
            if (targetIdx > 0) {
                engine.setValue("[Playlist]", "SelectPlaylist", targetIdx);
            }
            MaschineMK3.librarySidebarPos = targetIdx;
            MaschineMK3.activeLibraryTab = tabName;
            MaschineMK3.updateLibraryTabLEDs();
        }, true);
    }, true);
};

MaschineMK3.updateLibraryTabLEDs = function() {
    var map = MaschineMK3.libraryTabMap;
    for (var dBtn in map) {
        if (map.hasOwnProperty(dBtn)) {
            MaschineMK3.setLed(dBtn, map[dBtn] === MaschineMK3.activeLibraryTab ? 63 : 16);
        }
    }
    MaschineMK3.setLed("d3", 16);  // Analyze — always dim (action, not tab)
    MaschineMK3.setLed("d4", 16);  // Rescan — always dim (action, not tab)
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
        engine.makeConnection(ch, "cue_indicator", function(value) {
            MaschineMK3.setLed("recCountIn", value ? 63 : 0);
        })
    );

    // Trigger immediate update
    MaschineMK3.setLed("play", engine.getValue(ch, "play_indicator") ? 63 : 0);
    MaschineMK3.setLed("restartLoop", 16);
    MaschineMK3.setLed("recCountIn", engine.getValue(ch, "cue_indicator") ? 63 : 0);
};

// ---------------------------------------------------------------------------
// updateTouchstripLEDs — visualize crossfader position on the 25-segment strip.
// Crossfader value: -1 (full left) to +1 (full right). Center = 0.
// ---------------------------------------------------------------------------
MaschineMK3.updateTouchstripLEDs = function() {
    if (MaschineMK3.padMode === "t9") { return; }
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

    // Map position to crossfader (-1 to +1) and update strip LEDs directly
    if (touching && raw !== MaschineMK3.touchstripLastValue) {
        var norm = Math.max(0, Math.min(1, raw / 1024.0));
        var xfader = (norm * 2.0) - 1.0;
        engine.setValue("[Master]", "crossfader", xfader);

        if (MaschineMK3.padMode !== "t9") {
            // Update strip LEDs directly (faster than going via crossfader connection)
            var ledPos = Math.round(norm * 24);
            var C = MaschineMK3.Color;
            for (var i = 0; i < 25; i++) {
                var ledName = "ts" + (i + 1);
                if (i === ledPos) {
                    MaschineMK3.report81[MaschineMK3.leds[ledName][1]] = C.WHITE;
                } else if (i === 12) {
                    MaschineMK3.report81[MaschineMK3.leds[ledName][1]] = C.BLUE;
                } else {
                    MaschineMK3.report81[MaschineMK3.leds[ledName][1]] = C.OFF;
                }
            }
            // Single send for all strip LEDs
            controller.send(MaschineMK3.report81.slice(1), 42, 0x81);
        }
    }

    MaschineMK3.touchstripTouched = touching;
    MaschineMK3.touchstripLastValue = raw;
};

// ---------------------------------------------------------------------------
// updatePadModeLED — show current pad mode on the performFxSelect LED.
// ---------------------------------------------------------------------------
MaschineMK3.updatePadModeLED = function() {
    // performFxSelect LED
    if (MaschineMK3.padMode === "loops") {
        MaschineMK3.setLed("performFxSelect", 63);
    } else if (MaschineMK3.padMode === "effects") {
        MaschineMK3.setLed("performFxSelect", 32);
    } else {
        MaschineMK3.setLed("performFxSelect", 8);
    }
    // notes LED — bright when cue display visible
    MaschineMK3.setLed("notes", MaschineMK3.cueDisplayVisible ? 63 : 0);
    // keyboard LED — bright when T9 active
    MaschineMK3.setLed("keyboard", MaschineMK3.padMode === "t9" ? 63 : 0);
};

// ---------------------------------------------------------------------------
// updatePadLEDs — set pad LED colours based on current mode and deck state.
// Pads 1-8 = Deck A, pads 9-16 = Deck B.
// ---------------------------------------------------------------------------
MaschineMK3.updatePadLEDs = function() {
    var C = MaschineMK3.Color;
    var ch = "[Channel" + MaschineMK3.activeDeck + "]";

    // T9 mode: Python daemon controls pad LEDs
    if (MaschineMK3.padMode === "t9") { return; }

    // (no null/off state — cuepoints is the default)

    if (MaschineMK3.padMode === "cuepoints") {
        // Pads 1-8 = Deck 1 cues 1-8, pads 9-16 = Deck 2 cues 1-8
        for (var pad = 1; pad <= 16; pad++) {
            var ledName = MaschineMK3.padPhysicalToLed[pad];
            var cueDeck = pad <= 8 ? "[Channel1]" : "[Channel2]";
            var cueNum = pad <= 8 ? pad : pad - 8;
            var hcStatus = engine.getValue(cueDeck, "hotcue_" + cueNum + "_status");
            MaschineMK3.setLed(ledName, hcStatus ? C.YELLOW : C.OFF);
        }
        return;
    }

    if (MaschineMK3.padMode === "loops") {
        var loopEnabled = engine.getValue(ch, "loop_enabled");
        var currentLoopSize = engine.getValue(ch, "beatloop_size");

        for (var pad = 1; pad <= 16; pad++) {
            var ledName = MaschineMK3.padPhysicalToLed[pad];
            var size = MaschineMK3.loopSizes[pad];
            var color = C.OFF;

            if (size > 0) {
                if (loopEnabled && currentLoopSize === size) {
                    color = C.GREEN;   // active loop
                } else {
                    color = C.CYAN;    // available
                }
            } else {
                switch (pad) {
                case 1: color = loopEnabled ? C.YELLOW : C.OFF; break;  // halve
                case 2: color = loopEnabled ? C.YELLOW : C.OFF; break;  // double
                case 3: color = loopEnabled ? C.GREEN : C.ORANGE; break; // reloop
                case 4: color = loopEnabled ? C.RED : C.OFF; break;     // exit
                }
            }
            MaschineMK3.setLed(ledName, color);
        }

    } else if (MaschineMK3.padMode === "effects") {
        for (var pad = 1; pad <= 16; pad++) {
            var ledName = MaschineMK3.padPhysicalToLed[pad];
            var fxDef = MaschineMK3.fxPadMap[pad];
            var color = C.OFF;

            if (fxDef.enable) {
                // Unit enable pad
                var unitGroup = "[EffectRack1_EffectUnit" + fxDef.unit + "]";
                var unitEnabled = engine.getValue(unitGroup, "enabled");
                color = unitEnabled ? C.RED : C.PINK;
            } else {
                // Effect slot toggle
                var slotGroup = "[EffectRack1_EffectUnit" + fxDef.unit +
                                "_Effect" + fxDef.slot + "]";
                var slotEnabled = engine.getValue(slotGroup, "enabled");
                color = slotEnabled ? C.PURPLE : C.BLUE;
            }

            MaschineMK3.setLed(ledName, color);
        }
    }
};

// ---------------------------------------------------------------------------
// onButtonPress — called for each detected button press edge.
// ---------------------------------------------------------------------------
MaschineMK3.onButtonPress = function(name) {
    var ch = "[Channel" + MaschineMK3.activeDeck + "]";

    // --- Mouse mode toggle: Auto + Macro combo ---
    if (name === "auto" || name === "macroSet") {
        var autoHeld = name === "auto" || (MaschineMK3.lastButtonState["auto"] || false);
        var macroHeld = name === "macroSet" || (MaschineMK3.lastButtonState["macroSet"] || false);
        if (autoHeld && macroHeld) {
            MaschineMK3.mouseMode = !MaschineMK3.mouseMode;
            MaschineMK3.autoPressed = false;
            MaschineMK3.setLed("auto", 0);
            return;
        }
    }

    // --- Auto button: enable knob snap-back mode ---
    if (name === "auto") {
        MaschineMK3.autoPressed = true;
        MaschineMK3.setLed("auto", 63);
        return;
    }

    // --- Knob touch: save value when Auto is held ---
    var knobName = MaschineMK3.knobTouchToName[name];
    if (knobName) {
        if (MaschineMK3.autoPressed) {
            MaschineMK3.autoSnapSave(knobName);
        }
        return;
    }

    // Ignore nav/stepper inputs when mouse mode is active
    if (MaschineMK3.mouseMode) {
        if (name === "navUp" || name === "navDown" || name === "navLeft" ||
            name === "navRight" || name === "navPush") {
            return;
        }
    }

    switch (name) {
    // --- Transport: follows active deck ---
    case "play":
        if (MaschineMK3.shiftPressed) {
            // Shift+play: start both decks from their cue points
            engine.setValue("[Channel1]", "cue_gotoandplay", 1);
            engine.setValue("[Channel2]", "cue_gotoandplay", 1);
        } else {
            engine.setValue(ch, "play", !engine.getValue(ch, "play"));
        }
        break;
    case "stop":
        if (MaschineMK3.shiftPressed) {
            engine.setValue("[Channel1]", "stop", 1);
            engine.setValue("[Channel2]", "stop", 1);
        } else {
            engine.setValue(ch, "stop", 1);
        }
        break;
    case "recCountIn":
        engine.setValue(ch, "cue_default", 1);
        break;
    case "restartLoop":
        engine.setValue(ch, "playposition", 0);
        break;

    // --- Modifier ---
    case "shift":
        MaschineMK3.shiftPressed = true;
        MaschineMK3.setLed("shift", 63);
        engine.setValue("[Skin]", "shift_held", 1);
        break;

    // --- G1-G8: Stem mute (normal) or stem solo (shift) ---
    // G1-G4 = Deck A stems 1-4, G5-G8 = Deck B stems 1-4
    case "g1": case "g2": case "g3": case "g4":
    case "g5": case "g6": case "g7": case "g8":
        var gIdx = parseInt(name.charAt(1), 10);  // 1-8
        var gDeck = gIdx <= 4 ? 1 : 2;
        var gStem = gIdx <= 4 ? gIdx : gIdx - 4;  // stem 1-4
        var stemGroup = "[Channel" + gDeck + "_Stem" + gStem + "]";
        if (MaschineMK3.shiftPressed) {
            // Shift+G: solo/unsolo this stem (mute all others, or unmute all if already solo)
            var allOthersMuted = true;
            var thisMuted = engine.getValue(stemGroup, "mute");
            for (var s = 1; s <= 4; s++) {
                if (s !== gStem) {
                    if (!engine.getValue("[Channel" + gDeck + "_Stem" + s + "]", "mute")) {
                        allOthersMuted = false;
                        break;
                    }
                }
            }
            if (allOthersMuted && !thisMuted) {
                // Already solo — unsolo (unmute all)
                for (var s2 = 1; s2 <= 4; s2++) {
                    engine.setValue("[Channel" + gDeck + "_Stem" + s2 + "]", "mute", 0);
                }
            } else {
                // Solo: mute all others, unmute this
                for (var s3 = 1; s3 <= 4; s3++) {
                    engine.setValue("[Channel" + gDeck + "_Stem" + s3 + "]", "mute", s3 !== gStem ? 1 : 0);
                }
            }
        } else {
            // Normal: toggle mute
            var muted = engine.getValue(stemGroup, "mute");
            engine.setValue(stemGroup, "mute", muted ? 0 : 1);
        }
        break;

    // --- Notes button: toggle cue point display panel ---
    case "notes":
        MaschineMK3.cueDisplayVisible = !MaschineMK3.cueDisplayVisible;
        if (MaschineMK3.cueDisplayVisible) {
            MaschineMK3.libraryVisible = false;
            MaschineMK3.mixerVisible = false;
            MaschineMK3.stemMixerVisible = false;
            MaschineMK3.tempoVisible = false;
        }
        MaschineMK3.setLed("notes", MaschineMK3.cueDisplayVisible ? 63 : 0);
        MaschineMK3.updateTempoLed();
        MaschineMK3.updatePanels();
        break;

    // --- Pad mode: performFxSelect toggles loops, shift+performFxSelect toggles effects ---
    case "performFxSelect":
        if (MaschineMK3.shiftPressed) {
            // Shift + press: toggle effects mode on/off
            MaschineMK3.padMode = (MaschineMK3.padMode === "effects") ? "cuepoints" : "effects";
        } else {
            // Normal press: toggle loops mode on/off
            MaschineMK3.padMode = (MaschineMK3.padMode === "loops") ? "cuepoints" : "loops";
        }
        // Close other panels if opening loops/effects
        if (MaschineMK3.padMode !== "cuepoints") {
            MaschineMK3.libraryVisible = false;
            MaschineMK3.mixerVisible = false;
            MaschineMK3.stemMixerVisible = false;
            MaschineMK3.cueDisplayVisible = false;
            MaschineMK3.tempoVisible = false;
        }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
        MaschineMK3.updateTempoLed();
        MaschineMK3.updatePanels();
        break;

    // --- D buttons: library tabs (D1-D4 when library open) or per-deck controls ---
    case "d1": case "d2": case "d3": case "d4":
    case "d5": case "d6": case "d7": case "d8":
        var dNum = parseInt(name.charAt(1), 10);  // 1-8
        // Library tab switching: D1-D4 when library is visible
        if (MaschineMK3.libraryVisible && MaschineMK3.libraryTabMap[name]) {
            MaschineMK3.selectLibraryTab(MaschineMK3.libraryTabMap[name]);
            break;
        }
        if (MaschineMK3.libraryVisible && name === "d3") {
            engine.setValue("[Library]", "analyzeTracks", 1);
            break;
        }
        if (MaschineMK3.libraryVisible && name === "d4") {
            engine.setValue("[Library]", "scanLibrary", 1);
            break;
        }
        // Tempo panel D-button routing
        if (MaschineMK3.tempoVisible) {
            if (dNum === 1) {
                engine.setValue("[Channel1]", "sync_enabled",
                    engine.getValue("[Channel1]", "sync_enabled") ? 0 : 1);
            } else if (dNum === 5) {
                engine.setValue("[Channel2]", "sync_enabled",
                    engine.getValue("[Channel2]", "sync_enabled") ? 0 : 1);
            } else if (dNum === 2) {
                engine.setValue("[Channel1]", "keylock",
                    engine.getValue("[Channel1]", "keylock") ? 0 : 1);
            } else if (dNum === 6) {
                engine.setValue("[Channel2]", "keylock",
                    engine.getValue("[Channel2]", "keylock") ? 0 : 1);
            } else if (dNum === 3) {
                if (MaschineMK3.tempoState.rampTimerA) {
                    MaschineMK3.stopRamp(1);
                } else {
                    MaschineMK3.startRamp(1);
                }
            } else if (dNum === 7) {
                if (MaschineMK3.tempoState.rampTimerB) {
                    MaschineMK3.stopRamp(2);
                } else {
                    MaschineMK3.startRamp(2);
                }
            } else if (dNum === 4) {
                engine.setValue("[Channel1]", "rate", 0);
            } else if (dNum === 8) {
                engine.setValue("[Channel2]", "rate", 0);
            }
            break;
        }
        // Normal DJ mode D-button behavior
        if (dNum === 1) {
            engine.setValue("[Channel1]", "sync_enabled",
                engine.getValue("[Channel1]", "sync_enabled") ? 0 : 1);
        } else if (dNum === 5) {
            engine.setValue("[Channel2]", "sync_enabled",
                engine.getValue("[Channel2]", "sync_enabled") ? 0 : 1);
        } else if (dNum === 2) {
            engine.setValue("[Channel1]", "rate_temp_down", 1);
        } else if (dNum === 6) {
            engine.setValue("[Channel2]", "rate_temp_down", 1);
        } else if (dNum === 3) {
            engine.setValue("[Channel1]", "rate_temp_up", 1);
        } else if (dNum === 7) {
            engine.setValue("[Channel2]", "rate_temp_up", 1);
        } else if (dNum === 4) {
            engine.setValue("[Channel1]", "pfl", engine.getValue("[Channel1]", "pfl") ? 0 : 1);
        } else if (dNum === 8) {
            engine.setValue("[Channel2]", "pfl", engine.getValue("[Channel2]", "pfl") ? 0 : 1);
        }
        break;

    // --- Deck select: arrow left/right ---
    case "arrowLeft":
        MaschineMK3.activeDeck = 1;
        MaschineMK3.updateDeckLEDs();
        break;
    case "arrowRight":
        MaschineMK3.activeDeck = 2;
        MaschineMK3.updateDeckLEDs();
        break;

    // --- Browser: toggle library panel + T9 input on the non-active deck's screen ---
    case "browserPlugin":
        MaschineMK3.libraryVisible = !MaschineMK3.libraryVisible;
        if (MaschineMK3.libraryVisible) {
            MaschineMK3.mixerVisible = false;
            MaschineMK3.stemMixerVisible = false;
            MaschineMK3.tempoVisible = false;
            MaschineMK3.padMode = "t9";
            MaschineMK3.librarySidebarPos = 0;
            MaschineMK3.activeLibraryTab = "tracks";
        } else {
            MaschineMK3.padMode = "cuepoints";
            MaschineMK3.sidebarVisible = false;
            engine.setValue("[Skin]", "show_sidebar", 0);
            MaschineMK3.setLed("arranger", 0);
        }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
        MaschineMK3.updateTempoLed();
        MaschineMK3.updatePanels();
        break;

    // --- Arranger: toggle sidebar when library is open ---
    case "arranger":
        if (MaschineMK3.libraryVisible) {
            MaschineMK3.sidebarVisible = !MaschineMK3.sidebarVisible;
            engine.setValue("[Skin]", "show_sidebar", MaschineMK3.sidebarVisible ? 1 : 0);
            MaschineMK3.setLed("arranger", MaschineMK3.sidebarVisible ? 63 : 0);
        }
        break;

    // --- Mixer: toggle mixer panel; Shift+mixer: toggle stem mixer ---
    case "mixer":
        if (MaschineMK3.shiftPressed) {
            MaschineMK3.stemMixerVisible = !MaschineMK3.stemMixerVisible;
            if (MaschineMK3.stemMixerVisible) {
                MaschineMK3.mixerVisible = false;
                MaschineMK3.libraryVisible = false;
                MaschineMK3.cueDisplayVisible = false;
                MaschineMK3.tempoVisible = false;
            }
        } else {
            MaschineMK3.mixerVisible = !MaschineMK3.mixerVisible;
            if (MaschineMK3.mixerVisible) {
                MaschineMK3.libraryVisible = false;
                MaschineMK3.stemMixerVisible = false;
                MaschineMK3.tempoVisible = false;
            }
        }
        if (MaschineMK3.padMode === "t9") { MaschineMK3.padMode = "cuepoints"; }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
        MaschineMK3.updateTempoLed();
        MaschineMK3.updatePanels();
        break;

    // --- Tempo: toggle tempo panel ---
    case "tempo":
        MaschineMK3.toggleTempoPanel();
        break;

    // --- Settings: Handled by mk3-overlay daemon ---
    case "settings":
        // Handled by mk3-overlay daemon
        break;

    // --- Navigation (4D encoder) ---
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
            // Cycle focus: search bar (1) → track table (3) → load track
            var focus = engine.getValue("[Library]", "focused_widget");
            if (focus === 1) {
                engine.setValue("[Library]", "focused_widget", 3);
            } else {
                engine.setValue("[Channel" + MaschineMK3.activeDeck + "]", "LoadSelectedTrack", 1);
                MaschineMK3.libraryVisible = false;
                MaschineMK3.padMode = "cuepoints";
                MaschineMK3.updatePadModeLED();
                MaschineMK3.updatePadLEDs();
                MaschineMK3.updatePanels();
            }
        }
        break;
    }
};

// ---------------------------------------------------------------------------
// onButtonRelease — called for each detected button release edge.
// ---------------------------------------------------------------------------
MaschineMK3.onButtonRelease = function(name) {
    // --- Auto button release: restore all snapped values ---
    if (name === "auto") {
        MaschineMK3.autoPressed = false;
        MaschineMK3.autoSnapRestoreAll();
        MaschineMK3.setLed("auto", 0);
        return;
    }

    // --- Knob touch release: restore snapped value for this knob ---
    var knobName = MaschineMK3.knobTouchToName[name];
    if (knobName) {
        MaschineMK3.autoSnapRestore(knobName);
        return;
    }

    // Ignore nav releases when mouse mode is active
    if (MaschineMK3.mouseMode) {
        if (name === "navUp" || name === "navDown" || name === "navLeft" ||
            name === "navRight" || name === "navPush") {
            return;
        }
    }

    switch (name) {
    case "shift":
        MaschineMK3.shiftPressed = false;
        MaschineMK3.setLed("shift", 8);
        engine.setValue("[Skin]", "shift_held", 0);
        break;
    case "browserPlugin":
        break;
    // G button releases — no action needed (stem mute is toggle)
    case "g1": case "g2": case "g3": case "g4":
    case "g5": case "g6": case "g7": case "g8":
        break;
    // Cue is momentary — release resets the control
    case "recCountIn":
        engine.setValue("[Channel" + MaschineMK3.activeDeck + "]", "cue_default", 0);
        break;
    // D button releases — tempo nudge (momentary)
    case "d2":
        if (!MaschineMK3.tempoVisible) { engine.setValue("[Channel1]", "rate_temp_down", 0); }
        break;
    case "d3":
        if (!MaschineMK3.tempoVisible) { engine.setValue("[Channel1]", "rate_temp_up", 0); }
        break;
    case "d6":
        if (!MaschineMK3.tempoVisible) { engine.setValue("[Channel2]", "rate_temp_down", 0); }
        break;
    case "d7":
        if (!MaschineMK3.tempoVisible) { engine.setValue("[Channel2]", "rate_temp_up", 0); }
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
// Knob → Mixxx control binding, based on current mode.
// Returns {group, key} or null (e.g. jog has no persistent value).
// ---------------------------------------------------------------------------
MaschineMK3.getKnobBinding = function(knobName) {
    if (MaschineMK3.stemMixerVisible) {
        // Stem mixer: opposite-side knobs control active deck's stems
        var stemKnobs = MaschineMK3.activeDeck === 1
            ? {k5: 1, k6: 2, k7: 3, k8: 4}
            : {k1: 1, k2: 2, k3: 3, k4: 4};
        var stemNum = stemKnobs[knobName];
        if (stemNum) {
            var stemGroup = "[Channel" + MaschineMK3.activeDeck + "_Stem" + stemNum + "]";
            if (MaschineMK3.shiftPressed) {
                return {group: stemGroup, key: "pan"};
            }
            return {group: stemGroup, key: "volume"};
        }
    }
    if (MaschineMK3.tempoVisible) {
        switch (knobName) {
        case "k1": return {group: "[Channel1]", key: "rate"};
        case "k2": return {group: "[Channel1]", key: "pitch_adjust"};
        case "k5": return {group: "[Channel2]", key: "rate"};
        case "k6": return {group: "[Channel2]", key: "pitch_adjust"};
        }
        return null;
    }
    if (MaschineMK3.mixerVisible) {
        switch (knobName) {
        case "k1": return {group: "[EqualizerRack1_[Channel1]_Effect1]", key: "parameter3"};
        case "k2": return {group: "[EqualizerRack1_[Channel1]_Effect1]", key: "parameter2"};
        case "k3": return {group: "[EqualizerRack1_[Channel1]_Effect1]", key: "parameter1"};
        case "k4": return {group: "[Channel1]", key: "volume"};
        case "k5": return {group: "[EqualizerRack1_[Channel2]_Effect1]", key: "parameter3"};
        case "k6": return {group: "[EqualizerRack1_[Channel2]_Effect1]", key: "parameter2"};
        case "k7": return {group: "[EqualizerRack1_[Channel2]_Effect1]", key: "parameter1"};
        case "k8": return {group: "[Channel2]", key: "volume"};
        }
    } else {
        switch (knobName) {
        case "k1": return {group: "[Channel1]", key: "rate"};
        case "k2": return MaschineMK3.shiftPressed
                        ? {group: "[Channel1]", key: "waveform_zoom"}
                        : null;  // jog — no persistent value
        case "k3": return {group: "[Channel1]", key: "volume"};
        case "k4": return {group: "[QuickEffectRack1_[Channel1]]", key: "super1"};
        case "k5": return {group: "[Channel2]", key: "rate"};
        case "k6": return MaschineMK3.shiftPressed
                        ? {group: "[Channel2]", key: "waveform_zoom"}
                        : null;
        case "k7": return {group: "[Channel2]", key: "volume"};
        case "k8": return {group: "[QuickEffectRack1_[Channel2]]", key: "super1"};
        }
    }
    return null;
};

// ---------------------------------------------------------------------------
// Auto-snap: save/restore knob values when Auto is held + knob touched.
// ---------------------------------------------------------------------------
MaschineMK3.knobTouchToName = {
    "knobTouch1": "k1", "knobTouch2": "k2", "knobTouch3": "k3", "knobTouch4": "k4",
    "knobTouch5": "k5", "knobTouch6": "k6", "knobTouch7": "k7", "knobTouch8": "k8"
};

MaschineMK3.autoSnapSave = function(knobName) {
    var binding = MaschineMK3.getKnobBinding(knobName);
    if (!binding) { return; }
    MaschineMK3.autoSnap[knobName] = {
        group: binding.group,
        key:   binding.key,
        value: engine.getValue(binding.group, binding.key)
    };
    // Tell the skin which knob slot has auto-touch active (1-based index)
    var idx = parseInt(knobName.charAt(1), 10);
    engine.setValue("[Skin]", "auto_touch_k" + idx, 1);
};

MaschineMK3.autoSnapRestore = function(knobName) {
    var snap = MaschineMK3.autoSnap[knobName];
    if (!snap) { return; }
    engine.setValue(snap.group, snap.key, snap.value);
    delete MaschineMK3.autoSnap[knobName];
    var idx = parseInt(knobName.charAt(1), 10);
    engine.setValue("[Skin]", "auto_touch_k" + idx, 0);
};

MaschineMK3.autoSnapRestoreAll = function() {
    for (var knobName in MaschineMK3.autoSnap) {
        if (MaschineMK3.autoSnap.hasOwnProperty(knobName)) {
            var snap = MaschineMK3.autoSnap[knobName];
            engine.setValue(snap.group, snap.key, snap.value);
            var idx = parseInt(knobName.charAt(1), 10);
            engine.setValue("[Skin]", "auto_touch_k" + idx, 0);
        }
    }
    MaschineMK3.autoSnap = {};
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

    // Cap delta to prevent jumps (encoder should only move a few ticks at a time)
    if (delta > 50) { delta = 50; }
    if (delta < -50) { delta = -50; }

    if (MaschineMK3.stemMixerVisible) {
        // --- Stem mixer mode: opposite-side knobs control active deck's stems ---
        var stemKnobs = MaschineMK3.activeDeck === 1
            ? {k5: 1, k6: 2, k7: 3, k8: 4}
            : {k1: 1, k2: 2, k3: 3, k4: 4};
        var stemNum = stemKnobs[name];
        if (stemNum) {
            var stemGroup = "[Channel" + MaschineMK3.activeDeck + "_Stem" + stemNum + "]";
            if (MaschineMK3.shiftPressed) {
                MaschineMK3.adjustValue(stemGroup, "pan", delta, 0.005, 0, 1);
            } else {
                MaschineMK3.adjustValue(stemGroup, "volume", delta, 0.005, 0, 1);
            }
            return;
        }
        // Non-stem knobs fall through to normal mode
    }

    if (MaschineMK3.tempoVisible) {
        switch (name) {
        case "k1":
            MaschineMK3.adjustValue("[Channel1]", "rate", delta, 0.002, -1, 1);
            break;
        case "k2":
            MaschineMK3.adjustValue("[Channel1]", "pitch_adjust", delta, 0.01, -6, 6);
            break;
        case "k4":
            MaschineMK3.handleRampTargetKnob(1, delta);
            break;
        case "k5":
            MaschineMK3.adjustValue("[Channel2]", "rate", delta, 0.002, -1, 1);
            break;
        case "k6":
            MaschineMK3.adjustValue("[Channel2]", "pitch_adjust", delta, 0.01, -6, 6);
            break;
        case "k8":
            MaschineMK3.handleRampTargetKnob(2, delta);
            break;
        }
        return;
    }

    if (MaschineMK3.mixerVisible) {
        // --- Mixer mode: K1-K4 = Deck A EQ+Vol, K5-K8 = Deck B EQ+Vol ---
        switch (name) {
        case "k1": // HI EQ
            MaschineMK3.adjustValue("[EqualizerRack1_[Channel1]_Effect1]", "parameter3", delta, 0.005, 0, 4);
            break;
        case "k2": // MID EQ
            MaschineMK3.adjustValue("[EqualizerRack1_[Channel1]_Effect1]", "parameter2", delta, 0.005, 0, 4);
            break;
        case "k3": // LO EQ
            MaschineMK3.adjustValue("[EqualizerRack1_[Channel1]_Effect1]", "parameter1", delta, 0.005, 0, 4);
            break;
        case "k4": // Volume
            MaschineMK3.adjustValue("[Channel1]", "volume", delta, 0.002, 0, 1);
            break;
        case "k5": // HI EQ
            MaschineMK3.adjustValue("[EqualizerRack1_[Channel2]_Effect1]", "parameter3", delta, 0.005, 0, 4);
            break;
        case "k6": // MID EQ
            MaschineMK3.adjustValue("[EqualizerRack1_[Channel2]_Effect1]", "parameter2", delta, 0.005, 0, 4);
            break;
        case "k7": // LO EQ
            MaschineMK3.adjustValue("[EqualizerRack1_[Channel2]_Effect1]", "parameter1", delta, 0.005, 0, 4);
            break;
        case "k8": // Volume
            MaschineMK3.adjustValue("[Channel2]", "volume", delta, 0.002, 0, 1);
            break;
        }
    } else {
        // --- Normal mode: K1-K4 = Deck A, K5-K8 = Deck B ---
        switch (name) {
        case "k1": // Tempo rate
            MaschineMK3.adjustValue("[Channel1]", "rate", delta, 0.002, -1, 1);
            break;
        case "k2": // Scrub/jog or Shift=zoom
            if (MaschineMK3.shiftPressed) {
                MaschineMK3.adjustValue("[Channel1]", "waveform_zoom", delta, -0.1, 1, 10);
            } else {
                engine.setValue("[Channel1]", "jog", delta * 0.1);
            }
            break;
        case "k3": // Volume
            MaschineMK3.adjustValue("[Channel1]", "volume", delta, 0.002, 0, 1);
            break;
        case "k4": // Filter
            MaschineMK3.adjustValue("[QuickEffectRack1_[Channel1]]", "super1", delta, 0.003, 0, 1);
            break;
        case "k5": // Tempo rate
            MaschineMK3.adjustValue("[Channel2]", "rate", delta, 0.002, -1, 1);
            break;
        case "k6": // Scrub/jog or Shift=zoom
            if (MaschineMK3.shiftPressed) {
                MaschineMK3.adjustValue("[Channel2]", "waveform_zoom", delta, -0.1, 1, 10);
            } else {
                engine.setValue("[Channel2]", "jog", delta * 0.1);
            }
            break;
        case "k7": // Volume
            MaschineMK3.adjustValue("[Channel2]", "volume", delta, 0.002, 0, 1);
            break;
        case "k8": // Filter
            MaschineMK3.adjustValue("[QuickEffectRack1_[Channel2]]", "super1", delta, 0.003, 0, 1);
            break;
        }
    }

    switch (name) {

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
    if (MaschineMK3.mouseMode) { return; }
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
    if (MaschineMK3.padMode === "t9") { return; }
    var ch = "[Channel" + MaschineMK3.activeDeck + "]";

    if (MaschineMK3.padMode === "cuepoints") {
        // Pads 1-8 = Deck 1 cues 1-8, pads 9-16 = Deck 2 cues 1-8
        var cueDeck = padNumber <= 8 ? "[Channel1]" : "[Channel2]";
        var cueNum = padNumber <= 8 ? padNumber : padNumber - 8;
        if (MaschineMK3.shiftPressed) {
            // Shift + pad: overwrite cue point (clear first, then set)
            engine.setValue(cueDeck, "hotcue_" + cueNum + "_clear", 1);
            engine.setValue(cueDeck, "hotcue_" + cueNum + "_set", 1);
        } else {
            // Normal pad: activate cue point (sets if not yet set)
            engine.setValue(cueDeck, "hotcue_" + cueNum + "_activate", 1);
        }
        MaschineMK3.updatePadLEDs();
        return;
    }

    if (MaschineMK3.padMode === "loops") {
        var size = MaschineMK3.loopSizes[padNumber];

        // Quantize to beat unless shift is held
        engine.setValue(ch, "quantize", MaschineMK3.shiftPressed ? 0 : 1);

        if (size > 0) {
            engine.setValue(ch, "beatloop_" + size + "_toggle", 1);
        } else {
            switch (padNumber) {
            case 1: engine.setValue(ch, "loop_halve", 1); break;
            case 2: engine.setValue(ch, "loop_double", 1); break;
            case 3: engine.setValue(ch, "reloop_toggle", 1); break;
            case 4: engine.setValue(ch, "reloop_toggle", 1); break;
            }
        }

    } else if (MaschineMK3.padMode === "effects") {
        var fxDef = MaschineMK3.fxPadMap[padNumber];
        if (!fxDef) { return; }

        if (fxDef.enable) {
            // Toggle unit enable
            var unitGroup = "[EffectRack1_EffectUnit" + fxDef.unit + "]";
            var enabled = engine.getValue(unitGroup, "enabled");
            engine.setValue(unitGroup, "enabled", enabled ? 0 : 1);
        } else if (MaschineMK3.shiftPressed) {
            // Shift + pad: cycle to next effect in this slot
            var slotGroup = "[EffectRack1_EffectUnit" + fxDef.unit +
                            "_Effect" + fxDef.slot + "]";
            engine.setValue(slotGroup, "effect_selector", 1);
        } else {
            // Toggle individual effect slot on/off
            var slotGroup = "[EffectRack1_EffectUnit" + fxDef.unit +
                            "_Effect" + fxDef.slot + "]";
            var slotEnabled = engine.getValue(slotGroup, "enabled");
            engine.setValue(slotGroup, "enabled", slotEnabled ? 0 : 1);
        }
    }

    MaschineMK3.updatePadLEDs();
};

// ---------------------------------------------------------------------------
// onPadRelease — called when a pad drops below the pressure threshold.
// padNumber: physical pad number (1-16).
// ---------------------------------------------------------------------------
MaschineMK3.onPadRelease = function(padNumber) {
    if (MaschineMK3.padMode === "t9") { return; }
    if (MaschineMK3.padMode === "cuepoints") {
        var cueDeck = padNumber <= 8 ? "[Channel1]" : "[Channel2]";
        var cueNum = padNumber <= 8 ? padNumber : padNumber - 8;
        engine.setValue(cueDeck, "hotcue_" + cueNum + "_activate", 0);
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
    // Overlay widget has focus — skip HID processing
    if (MaschineMK3.overlayActive) { return; }
    var reportId = data[0];
    if (reportId === 0x01) {
        MaschineMK3.parseReport01(data);
    } else if (reportId === MaschineMK3.PAD_REPORT_ID) {
        MaschineMK3.parseReport02(data);
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

    // --- Loop LED feedback (refresh pad LEDs when loop state changes) ---
    engine.makeConnection("[Channel1]", "loop_enabled",
        function() { MaschineMK3.updatePadLEDs(); });
    engine.makeConnection("[Channel2]", "loop_enabled",
        function() { MaschineMK3.updatePadLEDs(); });
    engine.makeConnection("[Channel1]", "beatloop_size",
        function() { MaschineMK3.updatePadLEDs(); });
    engine.makeConnection("[Channel2]", "beatloop_size",
        function() { MaschineMK3.updatePadLEDs(); });

    // --- G button LED feedback: stem connections created lazily on track load ---
    MaschineMK3.stemConnections = [];

    MaschineMK3.connectStemLEDs = function() {
        // Disconnect previous stem connections
        for (var i = 0; i < MaschineMK3.stemConnections.length; i++) {
            MaschineMK3.stemConnections[i].disconnect();
        }
        MaschineMK3.stemConnections = [];

        // Connect to stem controls (only exist after a stem file is loaded)
        for (var d = 1; d <= 2; d++) {
            for (var s = 1; s <= 4; s++) {
                (function(deck, stem) {
                    var stemGroup = "[Channel" + deck + "_Stem" + stem + "]";
                    var c1 = engine.makeConnection(stemGroup, "mute",
                        function() { MaschineMK3.updateStemLEDs(); });
                    var c2 = engine.makeConnection(stemGroup, "volume",
                        function() { MaschineMK3.updateStemLEDs(); });
                    var c3 = engine.makeConnection(stemGroup, "color",
                        function() { MaschineMK3.updateStemLEDs(); });
                    if (c1) { MaschineMK3.stemConnections.push(c1); }
                    if (c2) { MaschineMK3.stemConnections.push(c2); }
                    if (c3) { MaschineMK3.stemConnections.push(c3); }
                })(d, s);
            }
        }
        MaschineMK3.updateStemLEDs();
    };

    // --- Track loaded: reconnect stem LEDs, close library/T9 ---
    MaschineMK3.onTrackLoaded = function(value, group) {
        // Reconnect stem LEDs (stem controls only exist after loading a stem file)
        MaschineMK3.connectStemLEDs();

        if (value) {
            // Stop any active ramp on this deck
            var loadedDeck = (group === "[Channel1]") ? 1 : 2;
            var timerKey = (loadedDeck === 1) ? "rampTimerA" : "rampTimerB";
            if (MaschineMK3.tempoState[timerKey]) {
                MaschineMK3.stopRamp(loadedDeck);
            }
        }

        if (MaschineMK3.libraryVisible) {
            MaschineMK3.libraryVisible = false;
            if (MaschineMK3.padMode === "t9") { MaschineMK3.padMode = "cuepoints"; }
            MaschineMK3.cueDisplayVisible = false;
            MaschineMK3.updatePadModeLED();
            MaschineMK3.updatePadLEDs();
            MaschineMK3.updatePanels();
        }
    };
    engine.makeConnection("[Channel1]", "track_loaded", MaschineMK3.onTrackLoaded);
    engine.makeConnection("[Channel2]", "track_loaded", MaschineMK3.onTrackLoaded);

    // --- Hotcue pad LED feedback (cues 1-8 per deck) ---
    for (var hcPad = 1; hcPad <= 8; hcPad++) {
        (function(idx) {
            engine.makeConnection("[Channel1]", "hotcue_" + idx + "_status",
                function() { MaschineMK3.updatePadLEDs(); });
            engine.makeConnection("[Channel2]", "hotcue_" + idx + "_status",
                function() { MaschineMK3.updatePadLEDs(); });
        })(hcPad);
    }

    // --- D button LED feedback (per-deck sync + play indicators) ---
    engine.makeConnection("[Channel1]", "sync_enabled", function(value) {
        MaschineMK3.setLed("d1", value ? 63 : 16);
    });
    engine.makeConnection("[Channel2]", "sync_enabled", function(value) {
        MaschineMK3.setLed("d5", value ? 63 : 16);
    });
    // Stop ramp if sync is enabled on the ramping deck
    engine.makeConnection("[Channel1]", "sync_enabled", function(value) {
        if (value && MaschineMK3.tempoState.rampTimerA) {
            MaschineMK3.stopRamp(1);
        }
    });
    engine.makeConnection("[Channel2]", "sync_enabled", function(value) {
        if (value && MaschineMK3.tempoState.rampTimerB) {
            MaschineMK3.stopRamp(2);
        }
    });
    // Keylock LED feedback
    engine.makeConnection("[Channel1]", "keylock", function(value) {
        if (MaschineMK3.tempoVisible) {
            MaschineMK3.setLed("d2", value ? 63 : 16);
        }
    });
    engine.makeConnection("[Channel2]", "keylock", function(value) {
        if (MaschineMK3.tempoVisible) {
            MaschineMK3.setLed("d6", value ? 63 : 16);
        }
    });
    // PFL (headphone cue) LED feedback + auto headMix routing
    MaschineMK3.updateHeadphoneRouting = function() {
        var pfl1 = engine.getValue("[Channel1]", "pfl");
        var pfl2 = engine.getValue("[Channel2]", "pfl");
        if (!pfl1 && !pfl2) {
            // No PFL active — play full main mix in headphones
            engine.setValue("[Master]", "headMix", 1);
        } else if (pfl1 && pfl2) {
            // Both decks PFL — play full main mix in headphones
            engine.setValue("[Master]", "headMix", 1);
        } else {
            // One deck PFL — play only that deck (PFL only, no main mix)
            engine.setValue("[Master]", "headMix", 0);
        }
    };
    engine.makeConnection("[Channel1]", "pfl", function(value) {
        MaschineMK3.setLed("d4", value ? 63 : 16);
        MaschineMK3.updateHeadphoneRouting();
    });
    engine.makeConnection("[Channel2]", "pfl", function(value) {
        MaschineMK3.setLed("d8", value ? 63 : 16);
        MaschineMK3.updateHeadphoneRouting();
    });
    // Set initial routing (main mix in headphones)
    engine.setValue("[Master]", "headMix", 1);

    // Dim the D buttons (always available)
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

    // --- Pad mode LED ---
    MaschineMK3.updatePadModeLED();

    // --- Shift LED (dim = available) ---
    MaschineMK3.setLed("shift", 8);

    // --- Browser + Mixer LEDs (dim = available); settings LED managed by overlay daemon ---
    MaschineMK3.setLed("browserPlugin", 16);
    MaschineMK3.setLed("mixer", 16);
    MaschineMK3.setLed("tempo", 16);
    MaschineMK3.setLed("keyboard", 0);

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

    // --- Set up 4 effect units ---
    // Each unit has 3 effect slots. Load one distinct effect per slot.
    // Mixxx remembers loaded effects between sessions, so this only runs
    // if slots are empty. Shift+pad cycles the effect in that slot.
    //
    // Route all 4 units to both channels, mix=1, units enabled.
    // Individual effect slots start disabled (toggled via pads).
    for (var u = 1; u <= 4; u++) {
        var unitGroup = "[EffectRack1_EffectUnit" + u + "]";
        engine.setValue(unitGroup, "group_[Channel1]_enable", 1);
        engine.setValue(unitGroup, "group_[Channel2]_enable", 1);
        engine.setValue(unitGroup, "mix", 1);
        engine.setValue(unitGroup, "enabled", 1);

        // Load a different effect in each empty slot
        for (var s = 1; s <= 3; s++) {
            var slotGroup = "[EffectRack1_EffectUnit" + u + "_Effect" + s + "]";
            var loaded = engine.getValue(slotGroup, "loaded");
            if (!loaded) {
                // Step to a unique effect: (unit-1)*3 + slot steps from None
                var steps = ((u - 1) * 3) + s;
                for (var step = 0; step < steps; step++) {
                    engine.setValue(slotGroup, "effect_selector", 1);
                }
            }
            engine.setValue(slotGroup, "enabled", 0);
        }
    }

    // Set initial LED state
    MaschineMK3.updatePadLEDs();
    MaschineMK3.updateDeckLEDs();
    MaschineMK3.updatePanels();
};

// ---------------------------------------------------------------------------
// shutdown — called by Mixxx when the mapping is unloaded.
// ---------------------------------------------------------------------------
MaschineMK3.shutdown = function() {
    // Stop any active ramp timers
    if (MaschineMK3.tempoState.rampTimerA) { engine.stopTimer(MaschineMK3.tempoState.rampTimerA); }
    if (MaschineMK3.tempoState.rampTimerB) { engine.stopTimer(MaschineMK3.tempoState.rampTimerB); }
    if (MaschineMK3.tempoState.rampLedTimer) { engine.stopTimer(MaschineMK3.tempoState.rampLedTimer); }
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
