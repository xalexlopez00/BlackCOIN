#!/usr/bin/env bash
set -euo pipefail

# ==============================================================
# BlackCOIN VPS Seed Node - One-Command Setup
# ==============================================================
# Tested on: Ubuntu 22.04 / Debian 12 / Rocky Linux 9
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/blackcoin/main/setup-vps.sh | bash
#
# Or locally:
#   chmod +x setup-vps.sh && sudo ./setup-vps.sh
# ==============================================================

REPO_URL="${REPO_URL:-https://github.com/YOUR_ORG/blackcoin.git}"
BRANCH="${BRANCH:-main}"
NODE_VERSION="${NODE_VERSION:-18}"
BLACKCOIN_USER="${BLACKCOIN_USER:-blackcoin}"
BLACKCOIN_DIR="/opt/blackcoin"
DATA_DIR="/var/lib/blackcoin/data"
LOG_DIR="/var/log/blackcoin"
CONFIG_DIR="/etc/blackcoin"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC}  $1" >&2; exit 1; }

# --- Preflight -------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  err "This script must be run as root (use sudo)."
fi

if ! command -v curl &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq curl
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       BlackCOIN VPS Seed Node Setup         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# --- Install Node.js -------------------------------------------
info "Installing Node.js ${NODE_VERSION}..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
  ok "Node.js $(node -v) installed"
else
  ok "Node.js $(node -v) already installed"
fi

# --- Create user -----------------------------------------------
info "Creating system user '${BLACKCOIN_USER}'..."
if ! id -u "${BLACKCOIN_USER}" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "${BLACKCOIN_USER}"
  ok "User '${BLACKCOIN_USER}' created"
else
  ok "User '${BLACKCOIN_USER}' already exists"
fi

# --- Create directories ----------------------------------------
info "Creating directories..."
mkdir -p "${BLACKCOIN_DIR}" "${DATA_DIR}" "${LOG_DIR}" "${CONFIG_DIR}"
ok "Directories created"

# --- Clone / copy project files --------------------------------
info "Deploying BlackCOIN..."
cd /tmp
if [[ -d "${BLACKCOIN_DIR}/.git" ]]; then
  cd "${BLACKCOIN_DIR}"
  git pull
  ok "Repository updated"
else
  if git ls-remote "${REPO_URL}" &>/dev/null 2>&1; then
    git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" /tmp/blackcoin-tmp
    rsync -a --delete /tmp/blackcoin-tmp/ "${BLACKCOIN_DIR}/"
    rm -rf /tmp/blackcoin-tmp
    ok "Repository cloned from ${REPO_URL}"
  else
    warn "Cannot access ${REPO_URL}. Copying local files..."
    if [[ -f "./package.json" ]]; then
      rsync -a --exclude='node_modules' --exclude='.git' ./ "${BLACKCOIN_DIR}/"
      ok "Local files copied"
    else
      err "No local files found and cannot clone repository."
    fi
  fi
fi

cd "${BLACKCOIN_DIR}"

# --- Install dependencies & build ------------------------------
info "Installing npm dependencies..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev
ok "Dependencies installed"

info "Compiling TypeScript..."
if command -v npx &>/dev/null && [[ -f "node_modules/.bin/tsc" ]]; then
  npx tsc
elif command -v tsc &>/dev/null; then
  tsc
else
  npm install --save-dev typescript
  npx tsc
fi
ok "Build complete"

# --- Configuration ----------------------------------------------
info "Setting up configuration..."
if [[ ! -f "${CONFIG_DIR}/config.json" ]]; then
  if [[ -f "${BLACKCOIN_DIR}/config.seed.json" ]]; then
    cp "${BLACKCOIN_DIR}/config.seed.json" "${CONFIG_DIR}/config.json"
  else
    cat > "${CONFIG_DIR}/config.json" <<EOF
{
  "network": "mainnet",
  "httpPort": 3001,
  "p2pPort": 6001,
  "blockGenerationInterval": 60,
  "difficultyAdjustmentInterval": 10,
  "coinbaseAmount": 50,
  "halvingInterval": 210000,
  "minDifficulty": 2,
  "miningThreads": 1,
  "dataDir": "${DATA_DIR}",
  "bootstrapPeers": [],
  "maxPeers": 50,
  "logLevel": "info"
}
EOF
  fi
  ok "Configuration created at ${CONFIG_DIR}/config.json"
else
  ok "Configuration already exists"
fi

# --- Permissions -----------------------------------------------
info "Setting permissions..."
chown -R "${BLACKCOIN_USER}:${BLACKCOIN_USER}" "${BLACKCOIN_DIR}" "${DATA_DIR}" "${LOG_DIR}" "${CONFIG_DIR}"
chmod 755 "${BLACKCOIN_DIR}"
chmod 750 "${DATA_DIR}" "${LOG_DIR}" "${CONFIG_DIR}"
ok "Permissions set"

# --- systemd service ------------------------------------------
info "Installing systemd service..."
if [[ -f "${BLACKCOIN_DIR}/blackcoin.service" ]]; then
  cp "${BLACKCOIN_DIR}/blackcoin.service" /etc/systemd/system/blackcoin.service
  systemctl daemon-reload
  systemctl enable blackcoin
  ok "systemd service installed and enabled"
else
  warn "blackcoin.service not found, creating default..."
  cat > /etc/systemd/system/blackcoin.service <<EOF
[Unit]
Description=BlackCOIN Seed Node
After=network.target

[Service]
Type=simple
User=${BLACKCOIN_USER}
Group=${BLACKCOIN_USER}
WorkingDirectory=${BLACKCOIN_DIR}
Environment=NODE_ENV=production
Environment=HTTP_PORT=3001
Environment=P2P_PORT=6001
Environment=DATA_DIR=${DATA_DIR}
Environment=CONFIG_PATH=${CONFIG_DIR}/config.json
ExecStart=/usr/bin/node ${BLACKCOIN_DIR}/dist/index.js
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable blackcoin
  ok "Default systemd service installed"
fi

# --- Firewall --------------------------------------------------
info "Configuring firewall..."
if command -v ufw &>/dev/null; then
  ufw allow 3001/tcp comment 'BlackCOIN HTTP API'
  ufw allow 6001/tcp comment 'BlackCOIN P2P WebSocket'
  ufw allow 60000/udp comment 'BlackCOIN LAN Discovery'
  ok "UFW rules added"
elif command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-port=3001/tcp
  firewall-cmd --permanent --add-port=6001/tcp
  firewall-cmd --permanent --add-port=60000/udp
  firewall-cmd --reload
  ok "FirewallD rules added"
else
  warn "No firewall tool detected (ufw/firewalld). Open ports manually: 3001, 6001, 60000"
fi

# --- Log rotation ----------------------------------------------
info "Setting up log rotation..."
cat > /etc/logrotate.d/blackcoin <<EOF
${LOG_DIR}/*.log {
  daily
  rotate 7
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
}
EOF
ok "Log rotation configured"

# --- Start service ---------------------------------------------
info "Starting BlackCOIN seed node..."
systemctl start blackcoin
sleep 3

if systemctl is-active --quiet blackcoin; then
  ok "BlackCOIN is RUNNING"
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       BlackCOIN Seed Node DEPLOYED!         ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}API:${NC}       http://$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3001"
  echo -e "  ${CYAN}Wallet:${NC}    http://$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3001"
  echo -e "  ${CYAN}P2P:${NC}       ws://$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):6001"
  echo -e "  ${CYAN}Health:${NC}    http://localhost:3001/healthz"
  echo ""
  echo -e "  ${YELLOW}Status:${NC}   systemctl status blackcoin"
  echo -e "  ${YELLOW}Logs:${NC}     journalctl -u blackcoin -f"
  echo -e "  ${YELLOW}Config:${NC}   ${CONFIG_DIR}/config.json"
  echo ""
  echo -e "  Other nodes connect with:"
  echo -e "    ${CYAN}ws://$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):6001${NC}"
  echo ""
else
  err "Service failed to start. Check: journalctl -u blackcoin -n 50 --no-pager"
fi
