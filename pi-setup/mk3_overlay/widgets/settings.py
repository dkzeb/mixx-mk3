"""Settings widget for the MK3 overlay system.

Four pages: General, Controller, Library, Network.
Executes system commands directly (sudo reboot, etc.).
Info items query live system state on page enter.
"""
import json
import os
import socket
import subprocess

from ..widget import Widget, Page, ActionItem, ToggleItem, InfoItem
from .. import focus

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))  # pi-setup/
MK3_CONFIG_FILE = "/tmp/mk3-controller-config.json"
AUTOUPDATE_FILE = "/etc/mk3-autoupdate"


def _run(args):
    """Run a command, ignoring errors."""
    try:
        subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        pass


def _run_wait(args):
    """Run a command and wait for completion. Returns stdout or empty string."""
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=10)
        return result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ""


def _get_ip():
    try:
        return _run_wait(["hostname", "-I"]).split()[0]
    except (IndexError, Exception):
        return "unknown"


def _get_hostname():
    return socket.gethostname()


def _get_wifi():
    return _run_wait(["iwgetid", "-r"]) or "not connected"


def _get_version():
    version_file = os.path.join(PROJECT_DIR, "VERSION")
    if os.path.exists(version_file):
        try:
            with open(version_file) as f:
                return f.read().strip()
        except IOError:
            pass
    result = _run_wait(["git", "-C", PROJECT_DIR, "describe", "--tags", "--always"])
    return result or "unknown"


def _get_library_location():
    home = os.path.expanduser("~")
    mixxx_lib = os.path.join(home, ".mixxx", "mixxxdb.sqlite")
    if os.path.exists(mixxx_lib):
        return os.path.dirname(mixxx_lib)
    return "~/.mixxx"


def _autoupdate_enabled():
    return os.path.exists(AUTOUPDATE_FILE)


def _on_autoupdate_toggle(state):
    if state:
        try:
            with open(AUTOUPDATE_FILE, "w") as f:
                f.write("1\n")
        except IOError:
            pass
    else:
        try:
            os.remove(AUTOUPDATE_FILE)
        except OSError:
            pass


def _on_tailscale_toggle(state):
    if state:
        _run(["sudo", "tailscale", "up"])
    else:
        _run(["sudo", "tailscale", "down"])


def _do_reboot():
    _run(["sudo", "reboot"])


def _do_shutdown():
    _run(["sudo", "shutdown", "-h", "now"])


def _do_update():
    update_script = os.path.join(PROJECT_DIR, "mk3-update.sh")
    _run(["sudo", "bash", update_script])


def _do_rescan():
    focus.send_rescan()


def _do_mount_usb():
    try:
        result = subprocess.run(
            ["lsblk", "-rno", "NAME,TYPE,MOUNTPOINT"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.strip().split("\n"):
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "part":
                name = parts[0]
                mountpoint = parts[2] if len(parts) > 2 else ""
                if mountpoint in ("/", "/boot", "/boot/firmware"):
                    continue
                if not mountpoint:
                    dev = f"/dev/{name}"
                    mount_dir = f"/media/usb-{name}"
                    os.makedirs(mount_dir, exist_ok=True)
                    subprocess.run(["sudo", "mount", dev, mount_dir], timeout=10)
                    return
    except (subprocess.TimeoutExpired, Exception):
        pass


def _do_unmount_usb():
    import glob as g
    for mount_dir in g.glob("/media/usb-*"):
        try:
            subprocess.run(["sudo", "umount", mount_dir], timeout=10)
            os.rmdir(mount_dir)
        except (subprocess.TimeoutExpired, OSError):
            pass


def _stub():
    pass


# --- Controller config (shared with JS mapping via /tmp/mk3-controller-config.json) ---

_CONTROLLER_DEFAULTS = {
    "vinyl_enabled": True,
    "vinyl_sensitivity": 3,  # 1-5 scale: 1=low, 3=medium, 5=high
}

# Sensitivity presets: maps 1-5 to (resolution, alpha) tuples
_VINYL_PRESETS = {
    1: {"resolution": 64,  "alpha": 0.0625},   # low: coarse, smooth
    2: {"resolution": 96,  "alpha": 0.09375},
    3: {"resolution": 128, "alpha": 0.125},     # medium (default)
    4: {"resolution": 192, "alpha": 0.1875},
    5: {"resolution": 256, "alpha": 0.25},      # high: fine, responsive
}


def _load_controller_config():
    try:
        with open(MK3_CONFIG_FILE, "r") as f:
            cfg = json.load(f)
            # Merge with defaults
            result = dict(_CONTROLLER_DEFAULTS)
            result.update(cfg)
            return result
    except (OSError, json.JSONDecodeError):
        return dict(_CONTROLLER_DEFAULTS)


def _save_controller_config(cfg):
    try:
        with open(MK3_CONFIG_FILE, "w") as f:
            json.dump(cfg, f, indent=2)
    except OSError:
        pass


def _on_vinyl_toggle(state):
    cfg = _load_controller_config()
    cfg["vinyl_enabled"] = state
    _save_controller_config(cfg)
    _apply_controller_config(cfg)


def _get_vinyl_sensitivity():
    cfg = _load_controller_config()
    level = cfg.get("vinyl_sensitivity", 3)
    labels = {1: "1 (Low)", 2: "2", 3: "3 (Medium)", 4: "4", 5: "5 (High)"}
    return labels.get(level, str(level))


def _apply_controller_config(cfg):
    """Patch the JS mapping constants and reload the controller.

    Writes updated VINYL_* constants directly into the JS file,
    then triggers a Mixxx controller reload via Ctrl+Shift+R.
    """
    js_path = os.path.join(
        os.path.expanduser("~"), ".mixxx", "controllers",
        "Native-Instruments-Maschine-MK3.js"
    )
    try:
        with open(js_path, "r") as f:
            content = f.read()

        import re
        enabled = "true" if cfg.get("vinyl_enabled", True) else "false"
        level = cfg.get("vinyl_sensitivity", 3)
        preset = _VINYL_PRESETS.get(level, _VINYL_PRESETS[3])

        content = re.sub(r'var VINYL_ENABLED = \w+;',
                         f'var VINYL_ENABLED = {enabled};', content)
        content = re.sub(r'var VINYL_RESOLUTION = \d+;',
                         f'var VINYL_RESOLUTION = {preset["resolution"]};', content)
        content = re.sub(r'var VINYL_ALPHA = [\d./]+;',
                         f'var VINYL_ALPHA = {preset["alpha"]};', content)
        content = re.sub(r'var VINYL_BETA = [\w./]+;',
                         f'var VINYL_BETA = {preset["alpha"] / 32};', content)

        with open(js_path, "w") as f:
            f.write(content)
    except OSError:
        pass


def _vinyl_sensitivity_knob(delta):
    """Adjust vinyl sensitivity via knob (K1). delta is raw knob ticks."""
    cfg = _load_controller_config()
    current = cfg.get("vinyl_sensitivity", 3)
    if delta > 0 and current < 5:
        cfg["vinyl_sensitivity"] = current + 1
    elif delta < 0 and current > 1:
        cfg["vinyl_sensitivity"] = current - 1
    else:
        return
    _save_controller_config(cfg)
    _apply_controller_config(cfg)


def create_settings_widget(position=None):
    """Create and return the settings widget with four pages configured."""
    pos = position or (0, 0, 960, 272)

    cfg = _load_controller_config()

    general = Page(title="GENERAL", items=[
        ActionItem(label="Reboot", on_execute=_do_reboot, confirm=True),
        ActionItem(label="Shutdown", on_execute=_do_shutdown, confirm=True),
        ActionItem(label="Check for Updates", on_execute=_do_update),
        ToggleItem(label="Auto-update on boot",
                   state=_autoupdate_enabled(),
                   on_toggle=_on_autoupdate_toggle),
        InfoItem(label="Version", value_fn=_get_version),
    ])

    controller = Page(
        title="CONTROLLER",
        items=[
            ToggleItem(label="Vinyl Scratch Mode",
                       state=cfg.get("vinyl_enabled", True),
                       on_toggle=_on_vinyl_toggle),
            InfoItem(label="Scratch Sensitivity",
                     value_fn=_get_vinyl_sensitivity),
            InfoItem(label="", value_fn=lambda: "Turn K1 to adjust sensitivity"),
        ],
        knob_bindings={"k1": _vinyl_sensitivity_knob},
    )

    library = Page(title="LIBRARY", items=[
        ActionItem(label="Rescan Library", on_execute=_do_rescan),
        ActionItem(label="Mount USB Drive", on_execute=_do_mount_usb),
        ActionItem(label="Unmount USB Drive", on_execute=_do_unmount_usb),
        InfoItem(label="Library Location", value_fn=_get_library_location),
    ])

    network = Page(title="NETWORK", items=[
        InfoItem(label="IP Address", value_fn=_get_ip),
        InfoItem(label="Hostname", value_fn=_get_hostname),
        InfoItem(label="WiFi Network", value_fn=_get_wifi),
        ActionItem(label="WiFi Select", on_execute=_stub),
        ToggleItem(label="Tailscale", state=False, on_toggle=_on_tailscale_toggle),
        ToggleItem(label="Hotspot", state=False, on_toggle=lambda s: None),
    ])

    return Widget(
        name="settings",
        position=pos,
        activate_button="settings",
        pages=[general, controller, library, network],
    )
