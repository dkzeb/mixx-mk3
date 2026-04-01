"""Focus trap: flag file and xdotool signaling for overlay activation."""
import os
import subprocess

FLAG_FILE = "/tmp/mk3-overlay-active"
DISPLAY = os.environ.get("DISPLAY", ":99")


def activate(display=None):
    """Signal that an overlay widget has taken focus."""
    _display = display or DISPLAY
    try:
        with open(FLAG_FILE, "w") as f:
            f.write("1\n")
    except IOError:
        pass
    _send_key("F12", _display)


def deactivate(display=None):
    """Signal that the overlay widget has released focus."""
    _display = display or DISPLAY
    try:
        os.remove(FLAG_FILE)
    except OSError:
        pass
    _send_key("F11", _display)


def send_rescan(display=None):
    """Send F10 to Mixxx to trigger library rescan."""
    _display = display or DISPLAY
    _send_key("F10", _display)


def is_active():
    """Check if the overlay flag file exists."""
    return os.path.exists(FLAG_FILE)


def _send_key(key, display):
    """Send a keystroke via xdotool."""
    try:
        subprocess.run(
            ["xdotool", "key", "--clearmodifiers", key],
            env={**os.environ, "DISPLAY": display},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=2,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
