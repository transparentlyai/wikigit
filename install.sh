#!/bin/bash

# WikiGit Installer for Debian/Ubuntu Systems
# This script automates the installation steps described in INSTALL.md

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for debug flag
DEBUG_MODE=false
for arg in "$@"; do
    if [ "$arg" == "--debug" ]; then
        DEBUG_MODE=true
        echo -e "${YELLOW}Debug mode enabled.${NC}"
        set -x
        break
    fi
done

# Set command flags based on debug mode
if [ "$DEBUG_MODE" = true ]; then
    PNPM_FLAGS="--loglevel debug --reporter=append-only"
    UV_FLAGS="-v"
    CURL_FLAGS="-fL" # Removed -s (silent)
    RSYNC_FLAGS="-avv"
else
    PNPM_FLAGS=""
    UV_FLAGS=""
    CURL_FLAGS="-fsSL"
    RSYNC_FLAGS="-av"
fi

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}       WikiGit Installer Setup           ${NC}"
echo -e "${BLUE}=========================================${NC}"

# Check if we're inside the repo
if [ ! -f "package.json" ] || [ ! -f "wikigit" ]; then
    echo -e "${RED}Error: Please run this script from the root of the wikigit repository.${NC}"
    exit 1
fi

# Check for sudo/root for system packages
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}This script requires sudo privileges to install system dependencies.${NC}"
    echo "Please enter your password if prompted."
    sudo -v
fi

# Keep sudo alive
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &

# 0. Installation Mode
echo -e "\n${BLUE}==> [0/9] Installation Mode...${NC}"
echo "How would you like to install WikiGit?"
echo "  1) Current User ($USER) in current directory ($(pwd))"
echo "     > Best for development or single-user setups."
echo "  2) Dedicated System User ('wikigit') in /opt/wikigit"
echo "     > Best for production servers."
read -r -p "Select option [1/2] (Default: 1): " INSTALL_MODE
INSTALL_MODE=${INSTALL_MODE:-1}

if [[ "$INSTALL_MODE" == "2" ]]; then
    TARGET_USER="wikigit"
    TARGET_GROUP="wikigit"
    INSTALL_DIR="/opt/wikigit"
    IS_SYSTEM_INSTALL=true
    echo -e "${YELLOW}Selected: System Install ($TARGET_USER in $INSTALL_DIR)${NC}"
else
    TARGET_USER=$(whoami)
    TARGET_GROUP=$(id -gn)
    INSTALL_DIR=$(pwd)
    IS_SYSTEM_INSTALL=false
    echo -e "${YELLOW}Selected: Local Install ($TARGET_USER in $INSTALL_DIR)${NC}"
fi

# 1. System Dependencies
echo -e "\n${BLUE}==> [1/8] Installing System Dependencies...${NC}"

# OS Check - Strict Debian 11+
if [ -f /etc/debian_version ]; then
    DEBIAN_VERSION_MAJOR=$(cut -d. -f1 /etc/debian_version)
    if [ "$DEBIAN_VERSION_MAJOR" -lt 11 ]; then
        echo -e "${RED}Error: This script requires Debian 11 (Bullseye) or newer.${NC}"
        echo "Detected Debian version: $(cat /etc/debian_version)"
        exit 1
    fi
else
    echo -e "${YELLOW}Warning: Non-Debian system detected. This script is optimized for Debian 11+.${NC}"
    echo "Proceeding anyway..."
    sleep 2
fi

sudo apt update
sudo apt install -y git build-essential curl

# 2. Node.js Setup
echo -e "\n${BLUE}==> [2/8] Setting up Node.js 20...${NC}"
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    echo "Installing Node.js 20..."
    curl $CURL_FLAGS https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js $(node -v) is already installed."
fi

# 3. Python 3.11 Setup
echo -e "\n${BLUE}==> [3/8] Setting up Python environment...${NC}"

# Check Debian version
DEBIAN_VERSION=$(cut -d. -f1 /etc/debian_version)
if [ "$DEBIAN_VERSION" -ge 12 ]; then
    echo "Debian 12+ detected. Installing system Python 3.11+..."
    sudo apt install -y python3-full python3-dev
else
    echo "Debian 11 (or older) detected. Installing build dependencies..."
    # On Debian 11, system Python is 3.9. We will let 'uv' manage Python 3.11.
    # We install common build deps just in case.
    sudo apt install -y python3-dev libssl-dev zlib1g-dev
fi

# 4. PNPM Setup
echo -e "\n${BLUE}==> [4/8] Installing pnpm...${NC}"
if ! command -v pnpm &> /dev/null || [[ $(pnpm --version) != 9.* ]]; then
    echo "Installing pnpm 9.0.0..."
    sudo npm install -g pnpm@9.0.0
else
    echo "pnpm $(pnpm --version) is already installed."
fi

# 5. UV Setup
echo -e "\n${BLUE}==> [5/8] Installing uv (Python package manager)...${NC}"

install_uv_for_user() {
    local t_user=$1
    local t_home=$2
    
    # Ensure .local/bin exists for deterministic install
    sudo -u "$t_user" mkdir -p "$t_home/.local/bin"

    if ! sudo -u "$t_user" test -f "$t_home/.local/bin/uv"; then
        echo "Installing uv for user $t_user..."
        # Force install to .local/bin
        sudo -u "$t_user" -H bash -c "curl $CURL_FLAGS https://astral.sh/uv/install.sh | UV_INSTALL_DIR=$t_home/.local/bin sh"
    else
        echo "uv is already installed for $t_user."
    fi
}

if [ "$IS_SYSTEM_INSTALL" = true ]; then
    # Create system user if needed
    if ! id "$TARGET_USER" &>/dev/null; then
        echo "Creating system user '$TARGET_USER' நான"
        sudo useradd -r -m -d "$INSTALL_DIR" -s /bin/bash "$TARGET_USER"
    fi

    # Setup directory
    if [ ! -d "$INSTALL_DIR" ]; then
        echo "Creating $INSTALL_DIR..."
        sudo mkdir -p "$INSTALL_DIR"
    fi

    echo "Copying files to $INSTALL_DIR..."
    # Sync files, excluding node_modules/venv/tmp to start clean or preserve bandwidth
    sudo rsync $RSYNC_FLAGS --exclude 'node_modules' --exclude '.venv' --exclude '.git' --exclude 'tmp' . "$INSTALL_DIR/"
    
    # Also sync .git if it exists so it's a repo
    if [ -d ".git" ]; then
        echo "Copying .git directory..."
        sudo rsync $RSYNC_FLAGS .git "$INSTALL_DIR/"
    fi

    echo "Setting permissions..."
    sudo chown -R "$TARGET_USER:$TARGET_GROUP" "$INSTALL_DIR"

    # Install uv for target user
    install_uv_for_user "$TARGET_USER" "$INSTALL_DIR"

else
    # Local install - just ensure current user has uv
    if ! command -v uv &> /dev/null; then
        curl $CURL_FLAGS https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
    else
        echo "uv is already installed."
    fi
fi

# 6. Project Dependencies
echo -e "\n${BLUE}==> [6/8] Installing Project Dependencies...${NC}"

if [ "$IS_SYSTEM_INSTALL" = true ]; then
    echo "Installing dependencies in $INSTALL_DIR as $TARGET_USER..."
    
    # Frontend
    echo "Running pnpm install..."

    # Create a temporary install script for frontend
    cat <<EOF | sudo tee "$INSTALL_DIR/install_frontend.sh" > /dev/null
#!/bin/bash
set -euxo pipefail
[ "$DEBUG_MODE" = "true" ] && set -x

export CI=true
export XDG_CACHE_HOME=$INSTALL_DIR/.cache
export XDG_DATA_HOME=$INSTALL_DIR/.local/share
export XDG_STATE_HOME=$INSTALL_DIR/.local/state
export NPM_CONFIG_CACHE=$INSTALL_DIR/.npm
export PATH=\$PATH:/usr/local/bin:/usr/bin:/bin

cd $INSTALL_DIR

echo "=== Frontend Install Diagnostics ==="
id
echo "PWD: \$(pwd)"
ls -ld .
echo "PATH: \$PATH"

echo "Current environment (before pnpm):"
env

echo "Verifying pnpm executable:"
which pnpm

echo "Checking network connectivity to npm registry:"
curl $CURL_FLAGS https://registry.npmjs.org || echo 'Network check failed'

echo "Cleaning previous temporary files..."
rm -rf _tmp_* .pnpm-store/v3/tmp

echo "Preparing package.json (removing packageManager field to prevent self-update loops)..."
cp package.json package.json.bak
# Use a temp file for sed to avoid race/permissions issues (though we are owner)
sed '/"packageManager":/d' package.json.bak > package.json

# Ensure we restore package.json even if install fails
trap "mv package.json.bak package.json" EXIT

echo "Starting pnpm install..."
# We use --ignore-scripts to prevent hanging on postinstall hooks during system install
# --jobs=1 caused an error, removing it.
pnpm --version
pnpm install $PNPM_FLAGS --store-dir .pnpm-store --ignore-scripts --no-frozen-lockfile --registry=https://registry.npmjs.org
EOF

    sudo chmod +x "$INSTALL_DIR/install_frontend.sh"
    sudo chown "$TARGET_USER:$TARGET_GROUP" "$INSTALL_DIR/install_frontend.sh"

    # Execute the script as the target user
    sudo -u "$TARGET_USER" -H "$INSTALL_DIR/install_frontend.sh" < /dev/null

    # Backend
    echo "Running uv sync..."
    
    # Use explicit path to uv in .local/bin
    UV_BIN="$INSTALL_DIR/.local/bin/uv"

    # Create a temporary install script for backend
    cat <<EOF | sudo tee "$INSTALL_DIR/install_backend.sh" > /dev/null
#!/bin/bash
set -e
[ "$DEBUG_MODE" = "true" ] && set -x

export CI=true
export XDG_CACHE_HOME=$INSTALL_DIR/.cache
export XDG_DATA_HOME=$INSTALL_DIR/.local/share

cd $INSTALL_DIR/apps/api

echo "=== Backend Install Diagnostics ==="
id
echo "PWD: \$(pwd)"

echo "Starting uv sync..."
$UV_BIN python install 3.11 $UV_FLAGS
$UV_BIN sync $UV_FLAGS
EOF

    sudo chmod +x "$INSTALL_DIR/install_backend.sh"
    sudo chown "$TARGET_USER:$TARGET_GROUP" "$INSTALL_DIR/install_backend.sh"

    # Execute the script as the target user
    sudo -u "$TARGET_USER" -H "$INSTALL_DIR/install_backend.sh" < /dev/null

    # Cleanup scripts
    sudo rm "$INSTALL_DIR/install_frontend.sh" "$INSTALL_DIR/install_backend.sh"

else
    # Local Install
    
    # Verify uv (for local script execution flow)
    if ! command -v uv &> /dev/null; then
        # Try to find it in common paths if not in PATH
        if [ -f "$HOME/.cargo/bin/uv" ]; then
            export PATH="$HOME/.cargo/bin:$PATH"
        elif [ -f "$HOME/.local/bin/uv" ]; then
            export PATH="$HOME/.local/bin:$PATH"
        else
            echo -e "${RED}Error: 'uv' not found in PATH. Please restart shell or add it to PATH.${NC}"
            exit 1
        fi
    fi

    # Install Python 3.11 via uv
    echo "Ensuring Python 3.11 is available via uv..."
    uv python install 3.11 $UV_FLAGS

    echo "Installing Frontend Dependencies (pnpm)..."
    pnpm install $PNPM_FLAGS

    echo "Installing Backend Dependencies (uv)..."
    cd apps/api
    uv sync $UV_FLAGS
    cd ../..
fi

# 7. Configuration
echo -e "\n${BLUE}==> [7/8] Configuration...${NC}"

CONFIG_PATH="$INSTALL_DIR/config.yaml"

if [ ! -f "$CONFIG_PATH" ]; then
    echo "Creating config.yaml from template..."
    if [ "$IS_SYSTEM_INSTALL" = true ]; then
        sudo cp "$INSTALL_DIR/config.yaml.example" "$CONFIG_PATH"
        sudo chown "$TARGET_USER:$TARGET_GROUP" "$CONFIG_PATH"
    else
        cp config.yaml.example config.yaml
    fi
    echo -e "${GREEN}Created config.yaml${NC}"
else
    echo "config.yaml already exists at $CONFIG_PATH. Skipping copy."
fi

# Interactive Setup
echo -e "\n${BLUE}==> Interactive Configuration${NC}"
echo "We will now configure the application settings."

# 1. App Name
read -r -p "Application Name [WikiGit]: " INPUT_APP_NAME
APP_NAME=${INPUT_APP_NAME:-WikiGit}

# 2. Admins
read -r -p "Admin Email Addresses (comma separated): " INPUT_ADMINS

# 3. Directories
DEFAULT_REPOS_DIR="$INSTALL_DIR/wiki-repositories"
DEFAULT_INDEX_DIR="$INSTALL_DIR/data/whoosh_index"

read -r -p "Repositories Root Directory [$DEFAULT_REPOS_DIR]: " INPUT_REPOS_DIR
REPOS_DIR=${INPUT_REPOS_DIR:-$DEFAULT_REPOS_DIR}

read -r -p "Search Index Directory [$DEFAULT_INDEX_DIR]: " INPUT_INDEX_DIR
INDEX_DIR=${INPUT_INDEX_DIR:-$DEFAULT_INDEX_DIR}

# 4. GitHub
read -r -p "GitHub Username: " INPUT_GITHUB_USER
read -r -s -p "GitHub Personal Access Token (Paste it): " INPUT_GITHUB_TOKEN
echo "" # newline after secret input

# Apply changes to config.yaml
echo "Updating configuration..."

# Function to run sed command (with or without sudo based on install mode)
run_sed() {
    if [ "$IS_SYSTEM_INSTALL" = true ]; then
        sudo sed -i "$@"
    else
        sed -i "$@"
    fi
}

# App Name
run_sed "s|app_name: WikiGit|app_name: $APP_NAME|" "$CONFIG_PATH"

# Directories
run_sed "s|repositories_root_dir: .*|repositories_root_dir: $REPOS_DIR|" "$CONFIG_PATH"
run_sed "s|index_dir: .*|index_dir: $INDEX_DIR|" "$CONFIG_PATH"

# GitHub User
if [ -n "$INPUT_GITHUB_USER" ]; then
    run_sed "s|user_id: \"\"|user_id: \"$INPUT_GITHUB_USER\"|" "$CONFIG_PATH"
fi

# Admins
if [ -n "$INPUT_ADMINS" ]; then
    IFS=',' read -ra ADDR <<< "$INPUT_ADMINS"
    
    # Replace the first default admin with the first input admin
    first_email=$(echo "${ADDR[0]}" | xargs)
    run_sed "s|- admin@example.com|- $first_email|" "$CONFIG_PATH"
    
    # Remove the second default example admin
    run_sed "/- editor@example.com/d" "$CONFIG_PATH"
    
    # Append remaining admins
    for ((i=1; i<${#ADDR[@]}; i++)); do
        email=$(echo "${ADDR[$i]}" | xargs)
        # Insert after the first email
        run_sed "/- $first_email/a \    - $email" "$CONFIG_PATH"
    done
fi

# Create/Update directories
if [ "$IS_SYSTEM_INSTALL" = true ]; then
    sudo mkdir -p "$REPOS_DIR" "$INDEX_DIR"
    sudo chown -R "$TARGET_USER:$TARGET_GROUP" "$REPOS_DIR" "$INDEX_DIR"
else
    mkdir -p "$REPOS_DIR" "$INDEX_DIR"
fi

# 8. CLI Setup
echo -e "\n${BLUE}==> [8/8] Setting up CLI...${NC}"

if [ "$IS_SYSTEM_INSTALL" = true ]; then
    # System install -> Global binary
    echo "Setting up global CLI command 'wikigit'..."
    sudo chmod +x "$INSTALL_DIR/wikigit"
    if [ -L "/usr/local/bin/wikigit" ]; then
        sudo rm "/usr/local/bin/wikigit"
    fi
    sudo ln -s "$INSTALL_DIR/wikigit" "/usr/local/bin/wikigit"
    echo "Linked to /usr/local/bin/wikigit"
else
    # Local install -> User bin
    chmod +x wikigit
    USER_BIN="$HOME/bin"
    if [ ! -d "$USER_BIN" ]; then
        mkdir -p "$USER_BIN"
    fi
    if [ -L "$USER_BIN/wikigit" ]; then
        rm "$USER_BIN/wikigit"
    fi
    ln -s "$(pwd)/wikigit" "$USER_BIN/wikigit"
    echo "Linked to $USER_BIN/wikigit"
    
    # Check PATH
    if [[ ":$PATH:" != *":$USER_BIN:"* ]]; then
        echo -e "${YELLOW}Warning: $USER_BIN is not in your PATH.${NC}"
        ADD_PATH_CMD="export PATH=\"
$USER_BIN:$PATH\"
"
    fi
fi

# 9. Git Configuration
echo -e "\n${BLUE}==> [9/9] Configuring Git...${NC}"

if [ "$IS_SYSTEM_INSTALL" = true ]; then
    echo "Configuring Git identity for $TARGET_USER..."
    sudo -u "$TARGET_USER" git config --global user.name "WikiGit System"
    sudo -u "$TARGET_USER" git config --global user.email "wikigit@localhost"
    sudo -u "$TARGET_USER" git config --global init.defaultBranch main
    # Mark the repo as safe to avoid "dubious ownership" errors if accessed differently
    sudo -u "$TARGET_USER" git config --global --add safe.directory "$REPOS_DIR"
    sudo -u "$TARGET_USER" git config --global --add safe.directory "$INSTALL_DIR/wiki-content"
else
    echo "Checking Git configuration..."
    if ! git config user.name > /dev/null || ! git config user.email > /dev/null; then
        echo -e "${YELLOW}Warning: Git user.name or user.email is not set.${NC}"
        echo "WikiGit requires Git to be configured to commit changes."
        echo "Please run: git config --global user.name 'Your Name' && git config --global user.email 'you@example.com'"
    fi
    git config --global init.defaultBranch main
fi

# 10. Systemd Service Setup
echo -e "\n${BLUE}==> [10/10] Setting up Systemd Service...${NC}"

# Determine paths for service
NODE_PATH=$(dirname "$(which node)")
PNPM_PATH=$(dirname "$(which pnpm)")

if [ "$IS_SYSTEM_INSTALL" = true ]; then
    # For system install, we forced uv to .local/bin
    UV_PATH="$INSTALL_DIR/.local/bin"
else
    # Local install: try to find where uv is
    UV_PATH=$(dirname "$(which uv)")
    if [ -z "$UV_PATH" ]; then
        # Fallbacks if which failed
        if [ -f "$HOME/.cargo/bin/uv" ]; then
            UV_PATH="$HOME/.cargo/bin"
        elif [ -f "$HOME/.local/bin/uv" ]; then
            UV_PATH="$HOME/.local/bin"
        fi
    fi
fi

SERVICE_PATH="$UV_PATH:$PNPM_PATH:$NODE_PATH:/usr/local/bin:/usr/bin:/bin"

# Create .env file
ENV_FILE="$INSTALL_DIR/.env"
# Always recreate or update .env to include the token if provided
echo "Configuring secrets in .env..."

# Prepare content
ENV_CONTENT="# WikiGit Secrets
GITHUB_TOKEN=${INPUT_GITHUB_TOKEN}
"

if [ "$IS_SYSTEM_INSTALL" = true ]; then
    echo "$ENV_CONTENT" | sudo -u "$TARGET_USER" tee "$ENV_FILE" > /dev/null
    sudo chmod 600 "$ENV_FILE"
    sudo chown "$TARGET_USER:$TARGET_GROUP" "$ENV_FILE"
else
    echo "$ENV_CONTENT" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
fi
echo "Secrets saved to $ENV_FILE"

# Generate Service File
SERVICE_FILE="/etc/systemd/system/wikigit.service"
echo "Generating service file at $SERVICE_FILE..."

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=WikiGit Service
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=$TARGET_USER
Group=$TARGET_GROUP
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$ENV_FILE
Environment="PATH=$SERVICE_PATH"
ExecStart=$INSTALL_DIR/wikigit start --logs $INSTALL_DIR/logs
ExecStop=$INSTALL_DIR/wikigit stop

[Install]
WantedBy=multi-user.target
EOF

# Enable and Start
echo "Enabling and starting wikigit service..."
sudo systemctl daemon-reload
sudo systemctl enable wikigit
sudo systemctl restart wikigit

echo -e "\n${GREEN}=========================================${NC}"
echo -e "${GREEN}       Installation Complete!            ${NC}"
echo -e "${GREEN}=========================================${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"

echo "1. Verify the service status:"
echo "   sudo systemctl status wikigit"

if [ -n "$ADD_PATH_CMD" ]; then
    echo "2. Add bin to PATH:"
    echo "   echo '$ADD_PATH_CMD' >> ~/.bashrc"
    echo "   source ~/.bashrc"
elif [ "$IS_SYSTEM_INSTALL" = true ]; then
    echo "2. Command 'wikigit' is now available globally."
fi

echo "3. Configure the application:"
if [ "$IS_SYSTEM_INSTALL" = true ]; then
    echo "   sudo nano $INSTALL_DIR/config.yaml"
    echo "   sudo nano $INSTALL_DIR/.env"
else
    echo "   nano config.yaml"
    echo "   nano .env"
fi

echo "4. Restart to apply changes:"
echo "   sudo systemctl restart wikigit"


echo -e "\nLogs are available at: $INSTALL_DIR/logs/"
