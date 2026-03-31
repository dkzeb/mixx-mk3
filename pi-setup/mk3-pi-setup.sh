#!/bin/bash
set -euo pipefail

echo "=== MK3 Mixxx Pi Setup ==="
echo ""

# ── Detect Pi paths ──────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PI_USER="${SUDO_USER:-$(whoami)}"
PI_HOME=$(eval echo "~$PI_USER")

echo "Project dir: $PROJECT_DIR"
echo "Pi user:     $PI_USER"
echo "Home:        $PI_HOME"
echo ""

# ── 1. Install system dependencies ──────────────────────────────────
echo "--- [1/8] Installing dependencies ---"
sudo apt-get update -qq
sudo apt-get install -y \
    mixxx \
    libusb-1.0-0-dev \
    libx11-dev \
    libxext-dev \
    xvfb \
    openbox \
    xdotool \
    cmake \
    build-essential \
    pkg-config \
    sqlite3 \
    pipewire \
    pipewire-alsa \
    pipewire-jack \
    zenity \
    wireplumber

# ── 2. Build screen daemon ──────────────────────────────────────────
echo "--- [2/8] Building screen daemon ---"
cd "$PROJECT_DIR"
rm -rf build && mkdir build && cd build
cmake .. -DCAPTURE_BACKEND=x11
cmake --build . --target mk3-screen-daemon -j"$(nproc)"
sudo install -m 755 screen-daemon/mk3-screen-daemon /usr/local/bin/mk3-screen-daemon
echo "Installed: /usr/local/bin/mk3-screen-daemon"

# ── 3. Install HID mapping ──────────────────────────────────────────
echo "--- [3/8] Installing MK3 controller mapping ---"
MIXXX_DIR="$PI_HOME/.mixxx/controllers"
mkdir -p "$MIXXX_DIR"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.hid.xml" "$MIXXX_DIR/"
cp "$PROJECT_DIR/mapping/Native-Instruments-Maschine-MK3.js" "$MIXXX_DIR/"
chown -R "$PI_USER:$PI_USER" "$PI_HOME/.mixxx"
echo "Mapping installed to: $MIXXX_DIR/"

# Install MK3 skin (system dir only — remove stale user copies)
rm -rf "$PI_HOME/.mixxx/skins/MK3"
SKIN_DIR="/usr/share/mixxx/skins/MK3"
sudo mkdir -p "$SKIN_DIR"
sudo cp "$PROJECT_DIR/skin/MK3/"*.xml "$SKIN_DIR/"
sudo cp "$PROJECT_DIR/skin/MK3/"*.qss "$SKIN_DIR/"
sudo cp "$PROJECT_DIR/skin/MK3/"*.png "$SKIN_DIR/" 2>/dev/null || true
echo "Skin installed to: $SKIN_DIR/"

# ── 4. Configure Mixxx ──────────────────────────────────────────────
echo "--- [4/8] Configuring Mixxx ---"
mkdir -p "$PI_HOME/Music"

# Pre-configure library directory in Mixxx's SQLite DB to skip first-run dialog
MIXXX_DB="$PI_HOME/.mixxx/mixxxdb.sqlite"
if [ ! -f "$MIXXX_DB" ]; then
    sqlite3 "$MIXXX_DB" "CREATE TABLE IF NOT EXISTS directories (directory TEXT UNIQUE);"
    sqlite3 "$MIXXX_DB" "INSERT OR IGNORE INTO directories (directory) VALUES ('$PI_HOME/Music');"
    echo "Mixxx library DB created: $PI_HOME/Music"
else
    sqlite3 "$MIXXX_DB" "CREATE TABLE IF NOT EXISTS directories (directory TEXT UNIQUE);"
    sqlite3 "$MIXXX_DB" "INSERT OR IGNORE INTO directories (directory) VALUES ('$PI_HOME/Music');"
    echo "Mixxx library DB updated: $PI_HOME/Music"
fi

# Detect MK3 serial number for controller config
# Mixxx names HID devices as: "Maschine MK3 <last4serial>_<interface>"
# Sanitized (spaces→underscores): "Maschine_MK3_<last4serial>_4"
MK3_SERIAL=$(lsusb -v -d 17cc:1600 2>/dev/null | grep iSerial | awk '{print $NF}')
if [ -n "$MK3_SERIAL" ]; then
    MK3_SUFFIX="${MK3_SERIAL: -4}"
    MK3_DEVICE_NAME="Maschine_MK3_${MK3_SUFFIX}_4"
    echo "MK3 detected: serial=$MK3_SERIAL, device name=$MK3_DEVICE_NAME"
else
    echo "WARNING: MK3 not connected — controller config will need manual setup"
    MK3_DEVICE_NAME=""
fi

# Set MK3 skin, fullscreen, and suppress first-run dialogs
cat > "$PI_HOME/.mixxx/mixxx.cfg" << CFGEOF
[Config]
ResizableSkin MK3
StartInFullscreen 1
hide_menubar 1
show_menubar_hint 0

[Library]
RescanOnStartup 1
CFGEOF

# Add controller config if MK3 was detected
if [ -n "$MK3_DEVICE_NAME" ]; then
    cat >> "$PI_HOME/.mixxx/mixxx.cfg" << CFGEOF

[Controller]
$MK3_DEVICE_NAME 1

[ControllerPreset]
$MK3_DEVICE_NAME Native-Instruments-Maschine-MK3.hid.xml
CFGEOF
    echo "Controller enabled: $MK3_DEVICE_NAME"
fi

chown -R "$PI_USER:$PI_USER" "$PI_HOME/.mixxx"
echo "Mixxx config: MK3 skin, fullscreen, menu hidden"

# Remove any old ALSA overrides (PipeWire handles audio routing now)
sudo rm -f /etc/asound.conf

# Pre-configure Mixxx sound output via JACK (PipeWire provides the JACK server)
# MK3 has 4 output channels: 0-1 = master, 2-3 = headphones
cat > "$PI_HOME/.mixxx/soundconfig.xml" << 'SNDEOF'
<!DOCTYPE SoundManagerConfig>
<SoundManagerConfig api="JACK Audio Connection Kit" deck_count="2" force_network_clock="0" latency="5" samplerate="48000" sync_buffers="2">
 <SoundDevice name="Maschine MK3 Analog Surround 4.0" portAudioIndex="7">
  <output channel="0" channel_count="2" index="0" type="Master"/>
  <output channel="2" channel_count="2" index="0" type="Headphones"/>
 </SoundDevice>
</SoundManagerConfig>
SNDEOF
chown "$PI_USER:$PI_USER" "$PI_HOME/.mixxx/soundconfig.xml"
echo "Mixxx audio: MK3 via PipeWire/JACK (master ch 0-1, headphones ch 2-3)"

# ── 5. Configure openbox for fullscreen (no decorations) ────────────
echo "--- [5/8] Configuring openbox (fullscreen, no decorations) ---"
OB_DIR="$PI_HOME/.config/openbox"
mkdir -p "$OB_DIR"
cat > "$OB_DIR/rc.xml" << 'OBEOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <applications>
    <application name="*">
      <decor>no</decor>
      <maximized>yes</maximized>
      <fullscreen>yes</fullscreen>
    </application>
  </applications>
</openbox_config>
OBEOF
chown -R "$PI_USER:$PI_USER" "$PI_HOME/.config"
echo "Openbox: no decorations, auto-fullscreen"

# ── 6. Install udev rules ───────────────────────────────────────────
echo "--- [6/8] Installing udev rules ---"
sudo cp "$SCRIPT_DIR/99-mk3.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
echo "udev rules installed."

# ── 7. Install systemd services ─────────────────────────────────────
echo "--- [7/8] Installing systemd services ---"

sudo cp "$SCRIPT_DIR/xvfb.service" /etc/systemd/system/
sudo cp "$SCRIPT_DIR/openbox.service" /etc/systemd/system/

# PipeWire runs as a user-level service (installed by the pipewire package).
# Enable it for this user so it starts on login/boot.
UID_NUM=$(id -u "$PI_USER")
sudo -u "$PI_USER" XDG_RUNTIME_DIR="/run/user/$UID_NUM" systemctl --user enable pipewire.service pipewire.socket wireplumber.service 2>/dev/null || true
# Ensure user services start at boot without requiring login
sudo loginctl enable-linger "$PI_USER"

# Remove any stale system-level PipeWire services from previous installs
sudo systemctl disable pipewire.service wireplumber.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/pipewire.service /etc/systemd/system/wireplumber.service

# Mixxx — patched for this user (uses pw-jack for PipeWire audio)
sed -e "s/User=pi/User=$PI_USER/" \
    -e "s|HOME=/home/pi|HOME=$PI_HOME|" \
    -e "s|/home/pi/mixx-mk3|$PI_HOME/mixx-mk3|" \
    -e "s|/run/user/1000|/run/user/$UID_NUM|" \
    "$SCRIPT_DIR/mixxx.service" | sudo tee /etc/systemd/system/mixxx.service > /dev/null

sudo cp "$SCRIPT_DIR/mk3-screen-daemon.service" /etc/systemd/system/

# Settings watcher — patched for this user
sed -e "s/User=pi/User=$PI_USER/" \
    -e "s|/home/pi/mixx-mk3|$PI_HOME/mixx-mk3|" \
    -e "s|/run/user/1000|/run/user/$UID_NUM|" \
    "$SCRIPT_DIR/mk3-settings-watcher.service" | sudo tee /etc/systemd/system/mk3-settings-watcher.service > /dev/null

# T9 text input daemon — patched for this user
sed -e "s/User=pi/User=$PI_USER/" \
    -e "s|/home/pi/mixx-mk3|$PI_HOME/mixx-mk3|" \
    "$SCRIPT_DIR/mk3-t9-daemon.service" | sudo tee /etc/systemd/system/mk3-t9-daemon.service > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable xvfb.service
sudo systemctl enable openbox.service
sudo systemctl enable mk3-screen-daemon.service
sudo systemctl enable mixxx.service
sudo systemctl enable mk3-settings-watcher.service
sudo systemctl enable mk3-t9-daemon.service

# Add user to required groups
sudo usermod -aG audio "$PI_USER"
sudo usermod -aG video "$PI_USER"
echo "Services enabled: xvfb, openbox, pipewire, wireplumber, mk3-screen-daemon, mixxx"

# ── 8. Verify ───────────────────────────────────────────────────────
echo "--- [8/8] Verifying ---"
echo "  Xvfb:    $(which Xvfb)"
echo "  openbox: $(which openbox)"
echo "  Mixxx:   $(mixxx --version 2>&1 | head -1)"
echo "  Daemon:  $(which mk3-screen-daemon)"
echo "  Mapping: $(ls "$MIXXX_DIR"/Native-Instruments-Maschine-MK3.* 2>/dev/null | wc -l) files"

# ── Done ─────────────────────────────────────────────────────────────
echo ""
echo "=============================="
echo "  Setup complete!"
echo "=============================="
echo ""
echo "Boot sequence:"
echo "  1. Xvfb starts (virtual 960x544 display on :99)"
echo "  2. openbox starts (no decorations, auto-fullscreen)"
echo "  3. Mixxx starts fullscreen on the virtual display"
echo "  4. mk3-screen-daemon captures display → mirrors to MK3 screens"
echo "  5. MK3 HID mapping auto-loads → controls are live"
echo ""
echo "Reboot to start:"
echo "  sudo reboot"
