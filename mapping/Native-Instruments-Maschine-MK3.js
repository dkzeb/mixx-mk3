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
MaschineMK3.libraryVisible  = false;    // whether the library panel is shown
MaschineMK3.mixerVisible    = false;    // whether the mixer panel is shown
MaschineMK3.settingsVisible = false;    // whether the settings panel is shown
MaschineMK3.settingsTab     = 0;        // 0=General, 1=Library, 2=Network
MaschineMK3.settingsCursor  = 0;        // index into current tab's selectable items
MaschineMK3.settingsConfirm = false;    // true when awaiting destructive confirmation
MaschineMK3.settingsConfirmTimer = 0;   // timer ID for auto-cancel

// Settings tab definitions: each item has type, label, and action key.
// type: "action" (chevron, NavPush executes), "toggle" (switch), "info" (read-only, cursor skips)
// confirm: true for destructive actions requiring two-step confirmation
MaschineMK3.settingsTabs = [
    { name: "GENERAL", items: [
        { type: "action",  label: "Reboot",              action: "reboot",    confirm: true },
        { type: "action",  label: "Shutdown",            action: "shutdown",  confirm: true },
        { type: "action",  label: "Check for Updates",   action: "update" },
        { type: "toggle",  label: "Auto-update on boot", action: "autoupdate", stateKey: "settingsAutoUpdate" },
        { type: "info",    label: "Version" },
    ]},
    { name: "LIBRARY", items: [
        { type: "action",  label: "Rescan Library",      action: "rescan" },
        { type: "action",  label: "Mount USB Drive",     action: "mount-usb" },
        { type: "action",  label: "Unmount USB Drive",   action: "unmount-usb" },
        { type: "info",    label: "Library Location" },
    ]},
    { name: "NETWORK", items: [
        { type: "info",    label: "IP Address" },
        { type: "info",    label: "Hostname" },
        { type: "info",    label: "WiFi Network" },
        { type: "action",  label: "WiFi Select",         action: "wifi-select" },
        { type: "toggle",  label: "Tailscale",           action: "tailscale", stateKey: "settingsTailscale" },
        { type: "toggle",  label: "Hotspot",             action: "hotspot",   stateKey: "settingsHotspot" },
    ]},
];

// Toggle states (persisted via command daemon)
MaschineMK3.settingsAutoUpdate = false;
MaschineMK3.settingsTailscale  = false;
MaschineMK3.settingsHotspot    = false;

// Returns the index of the next selectable item in the given direction.
// Wraps around. Returns current if no selectable items exist.
MaschineMK3.settingsNextSelectable = function(tab, current, direction) {
    var items = MaschineMK3.settingsTabs[tab].items;
    var len = items.length;
    if (len === 0) { return 0; }
    var idx = current;
    for (var i = 0; i < len; i++) {
        idx = (idx + direction + len) % len;
        if (items[idx].type !== "info") { return idx; }
    }
    return current;
};

// Returns the index of the first selectable item in a tab.
MaschineMK3.settingsFirstSelectable = function(tab) {
    var items = MaschineMK3.settingsTabs[tab].items;
    for (var i = 0; i < items.length; i++) {
        if (items[i].type !== "info") { return i; }
    }
    return 0;
};

MaschineMK3.padMode       = null;      // null | "loops" | "effects" | "cuepoints" | "t9" — null = pads inactive

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
    if (MaschineMK3.libraryVisible || MaschineMK3.mixerVisible) {
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
// updatePanels — show/hide library or mixer on the non-active deck's screen.
// Only one panel can be visible at a time. Both replace the non-active deck.
// ---------------------------------------------------------------------------
MaschineMK3.updatePanels = function() {
    var showLib = MaschineMK3.libraryVisible;
    var showMix = MaschineMK3.mixerVisible;
    var showSet = MaschineMK3.settingsVisible;
    var noPanelOpen = !showLib && !showMix && !showSet;
    var showPadsLoops = noPanelOpen && MaschineMK3.padMode === "loops";
    var showPadsFx = noPanelOpen && MaschineMK3.padMode === "effects";
    var showPadsCues = noPanelOpen && MaschineMK3.padMode === "cuepoints";
    var anyPanel = showLib || showMix || showSet || showPadsLoops || showPadsFx || showPadsCues;

    engine.setValue("[Skin]", "show_library", showLib ? 1 : 0);
    engine.setValue("[Skin]", "show_mixer", showMix ? 1 : 0);
    engine.setValue("[Skin]", "show_settings", showSet ? 1 : 0);
    engine.setValue("[Skin]", "show_t9", showLib ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_loops", showPadsLoops ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_fx", showPadsFx ? 1 : 0);
    engine.setValue("[Skin]", "show_pads_cues", showPadsCues ? 1 : 0);

    if (showLib) {
        // Library: always left screen, T9 pad overview: always right screen
        engine.setValue("[Skin]", "hide_deck_a", 1);
        engine.setValue("[Skin]", "hide_deck_b", 1);
    } else {
        // Other panels: replace non-active deck
        engine.setValue("[Skin]", "hide_deck_a", (anyPanel && MaschineMK3.activeDeck === 2) ? 1 : 0);
        engine.setValue("[Skin]", "hide_deck_b", (anyPanel && MaschineMK3.activeDeck === 1) ? 1 : 0);
    }

    MaschineMK3.setLed("browserPlugin", showLib ? 63 : 16);
    MaschineMK3.setLed("mixer", showMix ? 63 : 16);
    MaschineMK3.setLed("settings", showSet ? 63 : 16);

    if (showLib) {
        // focused_widget: 0=none, 1=search bar, 2=sidebar, 3=track table
        engine.setValue("[Library]", "focused_widget", 1);
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
    // padMode LED
    MaschineMK3.setLed("padMode", MaschineMK3.padMode === "cuepoints" ? 63 : 8);
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

    if (MaschineMK3.padMode === null) {
        for (var pad = 1; pad <= 16; pad++) {
            MaschineMK3.setLed(MaschineMK3.padPhysicalToLed[pad], C.OFF);
        }
        return;
    }

    if (MaschineMK3.padMode === "cuepoints") {
        for (var pad = 1; pad <= 16; pad++) {
            var ledName = MaschineMK3.padPhysicalToLed[pad];
            var hcStatus = engine.getValue(ch, "hotcue_" + pad + "_status");
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

    // --- G1-G8: Hotcues (G1-G4 = Deck A cues 1-4, G5-G8 = Deck B cues 1-4) ---
    case "g1": case "g2": case "g3": case "g4":
    case "g5": case "g6": case "g7": case "g8":
        var gIdx = parseInt(name.charAt(1), 10);  // 1-8
        var gDeck = gIdx <= 4 ? "[Channel1]" : "[Channel2]";
        var gCue = gIdx <= 4 ? gIdx : gIdx - 4;   // cue 1-4
        if (MaschineMK3.shiftPressed) {
            // Shift + press: set/move cue point to current position
            engine.setValue(gDeck, "hotcue_" + gCue + "_set", 1);
        } else {
            // Normal press: go to cue point (sets if not yet set)
            engine.setValue(gDeck, "hotcue_" + gCue + "_activate", 1);
        }
        break;

    // --- PadMode button: toggle cuepoints on pads ---
    case "padMode":
        MaschineMK3.padMode = (MaschineMK3.padMode === "cuepoints") ? null : "cuepoints";
        if (MaschineMK3.padMode === "cuepoints") {
            MaschineMK3.libraryVisible = false;
            MaschineMK3.mixerVisible = false;
            MaschineMK3.settingsVisible = false;
        }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
        MaschineMK3.updatePanels();
        break;

    // --- Pad mode: performFxSelect toggles loops, shift+performFxSelect toggles effects ---
    case "performFxSelect":
        if (MaschineMK3.shiftPressed) {
            // Shift + press: toggle effects mode on/off
            MaschineMK3.padMode = (MaschineMK3.padMode === "effects") ? null : "effects";
        } else {
            // Normal press: toggle loops mode on/off
            MaschineMK3.padMode = (MaschineMK3.padMode === "loops") ? null : "loops";
        }
        // Close library/mixer/settings if opening a pad mode
        if (MaschineMK3.padMode !== null) {
            MaschineMK3.libraryVisible = false;
            MaschineMK3.mixerVisible = false;
            MaschineMK3.settingsVisible = false;
        }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
        MaschineMK3.updatePanels();
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
    // D4/D8: headphone cue (PFL) toggle
    case "d4":
        engine.setValue("[Channel1]", "pfl", engine.getValue("[Channel1]", "pfl") ? 0 : 1);
        break;
    case "d8":
        engine.setValue("[Channel2]", "pfl", engine.getValue("[Channel2]", "pfl") ? 0 : 1);
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
            MaschineMK3.settingsVisible = false;
            MaschineMK3.padMode = "t9";
        } else {
            MaschineMK3.padMode = null;
        }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
        MaschineMK3.updatePanels();
        break;

    // --- Mixer: toggle mixer panel ---
    case "mixer":
        MaschineMK3.mixerVisible = !MaschineMK3.mixerVisible;
        if (MaschineMK3.mixerVisible) {
            MaschineMK3.libraryVisible = false;
            MaschineMK3.settingsVisible = false;
        }
        if (MaschineMK3.padMode === "t9") { MaschineMK3.padMode = null; }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
        MaschineMK3.updatePanels();
        break;

    // --- Settings: toggle settings panel ---
    case "settings":
        MaschineMK3.settingsVisible = !MaschineMK3.settingsVisible;
        if (MaschineMK3.settingsVisible) {
            MaschineMK3.libraryVisible = false;
            MaschineMK3.mixerVisible = false;
        }
        if (MaschineMK3.padMode === "t9") { MaschineMK3.padMode = null; }
        MaschineMK3.updatePadModeLED();
        MaschineMK3.updatePadLEDs();
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
            // Cycle focus: search bar (1) → track table (3) → load track
            var focus = engine.getValue("[Library]", "focused_widget");
            if (focus === 1) {
                // Search bar focused → move to track table
                engine.setValue("[Library]", "focused_widget", 3);
            } else {
                // Track table focused → load selected track and close library
                engine.setValue("[Channel" + MaschineMK3.activeDeck + "]", "LoadSelectedTrack", 1);
                MaschineMK3.libraryVisible = false;
                MaschineMK3.padMode = null;
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
    switch (name) {
    case "shift":
        MaschineMK3.shiftPressed = false;
        MaschineMK3.setLed("shift", 8);
        engine.setValue("[Skin]", "shift_held", 0);
        break;
    case "browserPlugin":
        break;
    // G button releases — deactivate hotcue
    case "g1": case "g2": case "g3": case "g4":
    case "g5": case "g6": case "g7": case "g8":
        var gIdx = parseInt(name.charAt(1), 10);
        var gDeck = gIdx <= 4 ? "[Channel1]" : "[Channel2]";
        var gCue = gIdx <= 4 ? gIdx : gIdx - 4;
        engine.setValue(gDeck, "hotcue_" + gCue + "_activate", 0);
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

    // Cap delta to prevent jumps (encoder should only move a few ticks at a time)
    if (delta > 50) { delta = 50; }
    if (delta < -50) { delta = -50; }

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
    if (MaschineMK3.padMode === null || MaschineMK3.padMode === "t9") { return; }
    var ch = "[Channel" + MaschineMK3.activeDeck + "]";

    if (MaschineMK3.padMode === "cuepoints") {
        if (MaschineMK3.shiftPressed) {
            // Shift + pad: set/move cue point
            engine.setValue(ch, "hotcue_" + padNumber + "_set", 1);
        } else {
            // Normal pad: activate cue point (sets if not yet set)
            engine.setValue(ch, "hotcue_" + padNumber + "_activate", 1);
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
        var ch = "[Channel" + MaschineMK3.activeDeck + "]";
        engine.setValue(ch, "hotcue_" + padNumber + "_activate", 0);
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

    // --- G button LED feedback (hotcue status for cues 1-4 per deck) ---
    MaschineMK3.updateGButtonLEDs = function() {
        var C = MaschineMK3.Color;
        for (var i = 1; i <= 4; i++) {
            var hc1 = engine.getValue("[Channel1]", "hotcue_" + i + "_status");
            MaschineMK3.setLed("g" + i, hc1 ? C.YELLOW : C.OFF);
            var hc2 = engine.getValue("[Channel2]", "hotcue_" + i + "_status");
            MaschineMK3.setLed("g" + (i + 4), hc2 ? C.ORANGE : C.OFF);
        }
    };
    for (var hc = 1; hc <= 4; hc++) {
        (function(idx) {
            engine.makeConnection("[Channel1]", "hotcue_" + idx + "_status",
                function() { MaschineMK3.updateGButtonLEDs(); });
            engine.makeConnection("[Channel2]", "hotcue_" + idx + "_status",
                function() { MaschineMK3.updateGButtonLEDs(); });
        })(hc);
    }
    MaschineMK3.updateGButtonLEDs();

    // --- Hotcue pad LED feedback ---
    for (var hcPad = 1; hcPad <= 16; hcPad++) {
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
    // PFL (headphone cue) LED feedback + auto headMix routing
    MaschineMK3.updateHeadphoneRouting = function() {
        var anyPfl = engine.getValue("[Channel1]", "pfl") || engine.getValue("[Channel2]", "pfl");
        // 0 = PFL only, 1 = main only
        engine.setValue("[Master]", "headMix", anyPfl ? 0 : 1);
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

    // --- Browser + Mixer + Settings LEDs (dim = available) ---
    MaschineMK3.setLed("browserPlugin", 16);
    MaschineMK3.setLed("mixer", 16);
    MaschineMK3.setLed("settings", 16);
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
