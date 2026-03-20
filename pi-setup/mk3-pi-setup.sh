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
