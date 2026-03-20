#!/bin/bash
set -euo pipefail

echo "=== MK3 Mixxx Pi Setup ==="
echo ""

# ── Detect Pi paths ──────────────────────────────────────────────────
BOOT_CONFIG="/boot/firmware/config.txt"
[ ! -f "$BOOT_CONFIG" ] && BOOT_CONFIG="/boot/config.txt"

BOOT_CMDLINE="/boot/firmware/cmdline.txt"
[ ! -f "$BOOT_CMDLINE" ] && BOOT_CMDLINE="/boot/cmdline.txt"

if [ ! -f "$BOOT_CONFIG" ]; then
    echo "Warning: Cannot find config.txt. Display config will be skipped."
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PI_USER="${SUDO_USER:-pi}"
PI_HOME=$(eval echo "~$PI_USER")

echo "Project dir: $PROJECT_DIR"
echo "Pi user:     $PI_USER"
echo "Home:        $PI_HOME"
echo ""

# ── 1. Install system dependencies ──────────────────────────────────
echo "--- [1/7] Installing dependencies ---"
sudo apt-get update -qq
sudo apt-get install -y \
    mixxx \
    libusb-1.0-0-dev \
    cmake \
    build-essential \
    pkg-config \
    libfreetype-dev

# ── 2. Build screen daemon ──────────────────────────────────────────
echo "--- [2/7] Building screen daemon ---"
cd "$PROJECT_DIR"
mkdir -p build && cd build
cmake .. -DUSE_DRM_CAPTURE=OFF
cmake --build . --target mk3-screen-daemon -j"$(nproc)"
sudo install -m 755 screen-daemon/mk3-screen-daemon /usr/local/bin/mk3-screen-daemon
echo "Installed: /usr/local/bin/mk3-screen-daemon"

# ── 3. Install HID mapping ──────────────────────────────────────────
echo "--- [3/7] Installing MK3 controller mapping ---"
MIXXX_DIR="$PI_HOME/.mixxx/controllers"
mkdir -p "$MIXXX_DIR"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.xml" "$MIXXX_DIR/"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.js" "$MIXXX_DIR/"
chown -R "$PI_USER:$PI_USER" "$PI_HOME/.mixxx"
echo "Mapping installed to: $MIXXX_DIR/"

# ── 4. Install udev rules ───────────────────────────────────────────
echo "--- [4/7] Installing udev rules ---"
sudo cp "$SCRIPT_DIR/99-mk3.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
echo "udev rules installed."

# ── 5. Install systemd services ─────────────────────────────────────
echo "--- [5/7] Installing systemd services ---"

# Patch the User= field if pi user is different
if [ "$PI_USER" != "pi" ]; then
    sed "s/User=pi/User=$PI_USER/" "$SCRIPT_DIR/mixxx.service" | sudo tee /etc/systemd/system/mixxx.service > /dev/null
    sudo cp "$SCRIPT_DIR/mk3-screen-daemon.service" /etc/systemd/system/
else
    sudo cp "$SCRIPT_DIR/mixxx.service" /etc/systemd/system/
    sudo cp "$SCRIPT_DIR/mk3-screen-daemon.service" /etc/systemd/system/
fi

# Fix HOME path in mixxx.service
sudo sed -i "s|HOME=/home/pi|HOME=$PI_HOME|" /etc/systemd/system/mixxx.service

sudo systemctl daemon-reload
sudo systemctl enable mk3-screen-daemon.service
sudo systemctl enable mixxx.service
echo "Services enabled: mk3-screen-daemon, mixxx"

# ── 6. Configure display ────────────────────────────────────────────
echo "--- [6/7] Configuring display ---"

if [ -f "$BOOT_CONFIG" ]; then
    # Force HDMI output even with no monitor
    if ! grep -q "hdmi_force_hotplug" "$BOOT_CONFIG"; then
        echo "hdmi_force_hotplug:0=1" | sudo tee -a "$BOOT_CONFIG"
    fi

    # Set framebuffer size for headless rendering
    if ! grep -q "framebuffer_width" "$BOOT_CONFIG"; then
        echo "framebuffer_width=960"  | sudo tee -a "$BOOT_CONFIG"
        echo "framebuffer_height=544" | sudo tee -a "$BOOT_CONFIG"
    fi

    echo "config.txt updated."
fi

# Set console resolution via kernel cmdline
if [ -f "$BOOT_CMDLINE" ]; then
    if ! grep -q "video=HDMI-A-1" "$BOOT_CMDLINE"; then
        sudo sed -i 's/$/ video=HDMI-A-1:960x544@30/' "$BOOT_CMDLINE"
    fi
    # Ensure fbcon is active (shows boot messages on framebuffer)
    if ! grep -q "fbcon=map" "$BOOT_CMDLINE"; then
        sudo sed -i 's/$/ fbcon=map:0/' "$BOOT_CMDLINE"
    fi
    echo "cmdline.txt updated."
fi

# ── 7. User and group setup ─────────────────────────────────────────
echo "--- [7/7] User and group setup ---"
sudo usermod -aG audio "$PI_USER"
sudo usermod -aG video "$PI_USER"
echo "User '$PI_USER' added to audio and video groups."

# ── Done ─────────────────────────────────────────────────────────────
echo ""
echo "=============================="
echo "  Setup complete!"
echo "=============================="
echo ""
echo "What happens on reboot:"
echo "  1. Pi boots → boot messages appear on MK3 screens"
echo "  2. mk3-screen-daemon starts (mirrors /dev/fb0 to MK3)"
echo "  3. Mixxx starts fullscreen → MK3 screens show Mixxx UI"
echo "  4. MK3 HID mapping auto-loads → controls are live"
echo ""
echo "Connect the MK3 via USB, then reboot:"
echo "  sudo reboot"
