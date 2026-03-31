#!/usr/bin/env python3
"""MK3 Settings command executor daemon.

Watches /tmp/mk3-settings-cmd for commands written by the Mixxx JS mapping
(via a bridge script) and executes system actions.

Runs as a systemd service alongside Mixxx.
"""
import os
import sys
import subprocess
import time

CMD_FILE = "/tmp/mk3-settings-cmd"
RESULT_FILE = "/tmp/mk3-settings-result"
POLL_INTERVAL = 0.5  # seconds


def execute_command(cmd):
    """Execute a settings command and return a result string."""
    cmd = cmd.strip()
    print(f"mk3-settings: executing '{cmd}'", file=sys.stderr)

    try:
        if cmd == "reboot":
            write_result("Rebooting...")
            subprocess.run(["sudo", "reboot"], check=False)
        elif cmd == "shutdown":
            write_result("Shutting down...")
            subprocess.run(["sudo", "shutdown", "-h", "now"], check=False)
        elif cmd == "update":
            write_result("Updating...")
            script_dir = os.path.dirname(os.path.abspath(__file__))
            subprocess.Popen(
                ["sudo", "bash", os.path.join(script_dir, "mk3-update.sh")],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        elif cmd == "mount-usb":
            mount_usb()
        elif cmd == "unmount-usb":
            unmount_usb()
        elif cmd == "tailscale-on":
            subprocess.run(["sudo", "tailscale", "up"], check=False)
            write_result("Tailscale connected")
        elif cmd == "tailscale-off":
            subprocess.run(["sudo", "tailscale", "down"], check=False)
            write_result("Tailscale disconnected")
        elif cmd == "tailscale-setup":
            tailscale_setup()
        elif cmd == "hotspot-on":
            write_result("Hotspot: not yet implemented")
        elif cmd == "hotspot-off":
            write_result("Hotspot: not yet implemented")
        elif cmd == "autoupdate-on":
            set_autoupdate(True)
        elif cmd == "autoupdate-off":
            set_autoupdate(False)
        else:
            write_result(f"Unknown command: {cmd}")
    except Exception as e:
        write_result(f"Error: {e}")


def write_result(msg):
    """Write a result message for the JS mapping to read."""
    try:
        with open(RESULT_FILE, "w") as f:
            f.write(msg + "\n")
    except IOError:
        pass
    print(f"mk3-settings: {msg}", file=sys.stderr)


def mount_usb():
    """Find and mount the first unmounted USB block device."""
    try:
        result = subprocess.run(
            ["lsblk", "-rno", "NAME,TYPE,MOUNTPOINT"],
            capture_output=True, text=True, check=True,
        )
        for line in result.stdout.strip().split("\n"):
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "part":
                name = parts[0]
                mountpoint = parts[2] if len(parts) > 2 else ""
                dev = f"/dev/{name}"
                # Skip root/boot partitions
                if mountpoint in ("/", "/boot", "/boot/firmware"):
                    continue
                if not mountpoint:
                    mount_dir = f"/media/usb-{name}"
                    os.makedirs(mount_dir, exist_ok=True)
                    subprocess.run(["sudo", "mount", dev, mount_dir], check=True)
                    write_result(f"Mounted {dev} at {mount_dir}")
                    return
        write_result("No USB drive found")
    except Exception as e:
        write_result(f"Mount failed: {e}")


def unmount_usb():
    """Unmount any USB drive mounted under /media/usb-*."""
    try:
        import glob as g
        mounts = g.glob("/media/usb-*")
        if not mounts:
            write_result("No USB drive mounted")
            return
        for mount_dir in mounts:
            subprocess.run(["sudo", "umount", mount_dir], check=True)
            os.rmdir(mount_dir)
        write_result("USB drive unmounted")
    except Exception as e:
        write_result(f"Unmount failed: {e}")


def tailscale_setup():
    """Run tailscale up and capture the auth URL for QR display."""
    try:
        proc = subprocess.Popen(
            ["sudo", "tailscale", "up"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        for line in iter(proc.stdout.readline, ""):
            line = line.strip()
            if "https://" in line:
                url = line.split()[-1] if line.split() else line
                write_result(f"tailscale-auth:{url}")
                display = os.environ.get("DISPLAY", ":99")
                try:
                    subprocess.run(
                        ["qrencode", "-o", "/tmp/mk3-tailscale-qr.png",
                         "-s", "6", "-m", "2", url],
                        check=True,
                    )
                    subprocess.Popen(
                        ["feh", "--fullscreen", "/tmp/mk3-tailscale-qr.png"],
                        env={**os.environ, "DISPLAY": display},
                    )
                except FileNotFoundError:
                    write_result(f"tailscale-auth:{url} (qrencode not installed)")
                break
        proc.wait()
    except Exception as e:
        write_result(f"Tailscale setup failed: {e}")


def set_autoupdate(enabled):
    """Enable or disable auto-update on boot."""
    config_file = "/etc/mk3-autoupdate"
    try:
        if enabled:
            with open(config_file, "w") as f:
                f.write("1\n")
            write_result("Auto-update enabled")
        else:
            if os.path.exists(config_file):
                os.remove(config_file)
            write_result("Auto-update disabled")
    except IOError as e:
        write_result(f"Config error: {e}")


def main():
    print("mk3-settings: daemon started, watching " + CMD_FILE, file=sys.stderr)

    # Clean up stale files
    for f in (CMD_FILE, RESULT_FILE):
        try:
            os.remove(f)
        except FileNotFoundError:
            pass

    while True:
        try:
            if os.path.exists(CMD_FILE):
                with open(CMD_FILE, "r") as f:
                    cmd = f.read().strip()
                os.remove(CMD_FILE)
                if cmd:
                    execute_command(cmd)
        except Exception as e:
            print(f"mk3-settings: error: {e}", file=sys.stderr)

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
