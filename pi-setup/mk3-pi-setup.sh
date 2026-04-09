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
echo "--- [1/9] Installing dependencies ---"
sudo apt-get update -qq
sudo apt-get install -y \
    libusb-1.0-0-dev \
    libfreetype-dev \
    libx11-dev \
    libxext-dev \
    libxfixes-dev \
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
    qrencode \
    feh \
    wireplumber \
    dmz-cursor-theme \
    x11-xserver-utils \
    cifs-utils \
    ffmpeg

# ── 1b. Install Mixxx 2.6 beta (pre-built .deb with stem support) ───
echo "--- [1b/9] Installing Mixxx 2.6 beta ---"
MIXXX_DEB="$PROJECT_DIR/mixxx_2.6.0-beta-1_arm64.deb"
if [ -f "$MIXXX_DEB" ]; then
    # Remove apt-installed mixxx if present (avoids conflicts)
    sudo apt-get remove -y mixxx mixxx-data 2>/dev/null || true
    sudo dpkg -i "$MIXXX_DEB" || sudo apt-get -f install -y
    echo "Mixxx 2.6 beta installed from .deb"
else
    echo "WARNING: $MIXXX_DEB not found — install Mixxx manually"
fi

# ── 2. Build screen daemon ──────────────────────────────────────────
echo "--- [2/9] Building screen daemon ---"
cd "$PROJECT_DIR"
rm -rf build && mkdir build && cd build
cmake .. -DCAPTURE_BACKEND=x11
cmake --build . --target mk3-screen-daemon mk3_cli -j"$(nproc)"
sudo install -m 755 screen-daemon/mk3-screen-daemon /usr/local/bin/mk3-screen-daemon
sudo install -m 755 external/mpi-tools/mk3_cli/mk3_cli /usr/local/bin/mk3
echo "Installed: /usr/local/bin/mk3-screen-daemon"
echo "Installed: /usr/local/bin/mk3"

# ── 3. Install HID mapping ──────────────────────────────────────────
echo "--- [3/9] Installing MK3 controller mapping ---"
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
sudo cp -r "$PROJECT_DIR/skin/MK3/"* "$SKIN_DIR/"
echo "Skin installed to: $SKIN_DIR/"

# ── 4. Configure Mixxx ──────────────────────────────────────────────
echo "--- [4/9] Configuring Mixxx ---"
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
 <SoundDevice name="Maschine MK3 Analog Surround 4.0" portAudioIndex="6">
  <output channel="0" channel_count="2" index="0" type="Master"/>
 </SoundDevice>
 <SoundDevice name="Built-in Audio Stereo" portAudioIndex="3">
  <output channel="0" channel_count="2" index="0" type="Headphones"/>
 </SoundDevice>
</SoundManagerConfig>
SNDEOF
chown "$PI_USER:$PI_USER" "$PI_HOME/.mixxx/soundconfig.xml"
echo "Mixxx audio: master on MK3, headphones on Pi 3.5mm jack"

# ── 5. Configure openbox for fullscreen (no decorations) ────────────
echo "--- [5/9] Configuring openbox (fullscreen, no decorations) ---"
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
echo "--- [6/9] Installing udev rules ---"
sudo cp "$SCRIPT_DIR/99-mk3.rules" /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
echo "udev rules installed."

# ── 7. Install systemd services ─────────────────────────────────────
echo "--- [7/9] Installing systemd services ---"

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
    -e "s|/home/pi/mixxx-mk3|$PI_HOME/mixxx-mk3|" \
    -e "s|/run/user/1000|/run/user/$UID_NUM|" \
    "$SCRIPT_DIR/mixxx.service" | sudo tee /etc/systemd/system/mixxx.service > /dev/null

sudo cp "$SCRIPT_DIR/mk3-screen-daemon.service" /etc/systemd/system/

# T9 text input daemon — patched for this user
sed -e "s/User=pi/User=$PI_USER/" \
    -e "s|/home/pi/mixxx-mk3|$PI_HOME/mixxx-mk3|" \
    "$SCRIPT_DIR/mk3-t9-daemon.service" | sudo tee /etc/systemd/system/mk3-t9-daemon.service > /dev/null

# Mouse mode daemon — patched for this user
sed -e "s/User=pi/User=$PI_USER/" \
    -e "s|/home/pi/mixxx-mk3|$PI_HOME/mixxx-mk3|" \
    "$SCRIPT_DIR/mk3-mouse-daemon.service" | sudo tee /etc/systemd/system/mk3-mouse-daemon.service > /dev/null

# Overlay widget system — patched for this user
sed -e "s/User=pi/User=$PI_USER/" \
    -e "s|HOME=/home/pi|HOME=$PI_HOME|" \
    -e "s|/home/pi/mixxx-mk3|$PI_HOME/mixxx-mk3|" \
    "$SCRIPT_DIR/mk3-overlay.service" | sudo tee /etc/systemd/system/mk3-overlay.service > /dev/null

# Boot splash — patched for this user
sed -e "s|/home/pi/mixxx-mk3|$PI_HOME/mixxx-mk3|" \
    "$SCRIPT_DIR/mk3-bootsplash.service" | sudo tee /etc/systemd/system/mk3-bootsplash.service > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable xvfb.service
sudo systemctl enable openbox.service
sudo systemctl enable mk3-bootsplash.service
sudo systemctl enable mk3-screen-daemon.service
sudo systemctl enable mixxx.service
sudo systemctl enable mk3-t9-daemon.service
sudo systemctl enable mk3-mouse-daemon.service
sudo systemctl enable mk3-overlay.service

# Add user to required groups
sudo usermod -aG audio "$PI_USER"
sudo usermod -aG video "$PI_USER"
echo "Services enabled: xvfb, openbox, pipewire, wireplumber, mk3-screen-daemon, mixxx"

# Pre-extract bootsplash frames for fast boot
SPLASH_GIF="$SCRIPT_DIR/bootsplash-left-anim.gif"
SPLASH_PNG="$SCRIPT_DIR/bootsplash-left.png"
SPLASH_DIR="/var/lib/mk3-bootsplash"
sudo mkdir -p "$SPLASH_DIR"
if [ -f "$SPLASH_GIF" ]; then
    sudo rm -f "$SPLASH_DIR"/frame_*.raw
    ffmpeg -v quiet -i "$SPLASH_GIF" -pix_fmt rgb565le -s 480x272 \
        -f rawvideo "$SPLASH_DIR/all_frames.raw" 2>/dev/null || true
    FRAME_BYTES=$((480 * 272 * 2))
    if [ -f "$SPLASH_DIR/all_frames.raw" ]; then
        FILE_SIZE=$(stat -c%s "$SPLASH_DIR/all_frames.raw")
        NFRAMES=$((FILE_SIZE / FRAME_BYTES))
        for ((i = 0; i < NFRAMES; i++)); do
            sudo dd if="$SPLASH_DIR/all_frames.raw" of="$SPLASH_DIR/frame_${i}.raw" \
                bs=$FRAME_BYTES skip=$i count=1 2>/dev/null
        done
        sudo rm -f "$SPLASH_DIR/all_frames.raw"
        echo "Bootsplash: $NFRAMES frames extracted to $SPLASH_DIR"
    fi
elif [ -f "$SPLASH_PNG" ]; then
    sudo rm -f "$SPLASH_DIR"/frame_*.raw
    ffmpeg -v quiet -i "$SPLASH_PNG" -pix_fmt rgb565le -s 480x272 \
        -f rawvideo "$SPLASH_DIR/frame_0.raw" 2>/dev/null || true
    echo "Bootsplash: static PNG extracted to $SPLASH_DIR"
fi

# ── 8. Tailscale VPN (optional) ────────────────────────────────────
echo "--- [8/9] Tailscale VPN ---"
if ! command -v tailscale &>/dev/null; then
    echo "Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh
fi

echo ""
read -p "Set up Tailscale VPN now? (y/n): " TAILSCALE_SETUP
if [ "$TAILSCALE_SETUP" = "y" ] || [ "$TAILSCALE_SETUP" = "Y" ]; then
    echo "Starting Tailscale..."
    echo "A login URL will appear below. Visit it in your browser to authenticate."
    echo ""
    sudo tailscale up
    echo ""
    echo "Tailscale status:"
    tailscale status
else
    echo "Tailscale installed but not configured."
    echo "You can set it up later via Settings > Network > Setup VPN on the MK3."
fi

# ── 9. SMB music share ─────────────────────────────────────────────
echo "--- [9/10] Setting up SMB music share ---"
mkdir -p "$PI_HOME/Music/nas"

if [ ! -f /etc/samba/credentials ]; then
    sudo mkdir -p /etc/samba
    echo ""
    read -p "SMB username: " SMB_USER
    read -sp "SMB password: " SMB_PASS
    echo ""
    printf "username=%s\npassword=%s\n" "$SMB_USER" "$SMB_PASS" | sudo tee /etc/samba/credentials > /dev/null
    sudo chmod 600 /etc/samba/credentials
    echo "SMB credentials saved to /etc/samba/credentials"
else
    echo "SMB credentials already exist at /etc/samba/credentials"
fi

# Install systemd mount unit (filename must match mount path: home-zeb-Music-nas.mount)
sed -e "s|uid=zeb|uid=$PI_USER|" \
    -e "s|gid=zeb|gid=$PI_USER|" \
    -e "s|/home/zeb/Music|$PI_HOME/Music|g" \
    "$SCRIPT_DIR/home-zeb-Music-nas.mount" | sudo tee /etc/systemd/system/home-zeb-Music-nas.mount > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable home-zeb-Music-nas.mount
echo "SMB share will mount to $PI_HOME/Music/nas on boot"

# Also add nas directory to Mixxx library
sqlite3 "$MIXXX_DB" "INSERT OR IGNORE INTO directories (directory) VALUES ('$PI_HOME/Music/nas');"
echo "Added $PI_HOME/Music/nas to Mixxx library"

# ── 10. Verify ──────────────────────────────────────────────────────
echo "--- [10/10] Verifying ---"
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
echo "  3. SMB music share mounts to $PI_HOME/Music/nas"
echo "  4. Mixxx starts fullscreen on the virtual display"
echo "  5. mk3-screen-daemon captures display → mirrors to MK3 screens"
echo "  6. MK3 HID mapping auto-loads → controls are live"
echo ""
echo "Reboot to start:"
echo "  sudo reboot"
