#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Dead or Alive: Logic Escape — First-Run Setup Script
# Usage: bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "\n${BOLD}💀 Dead or Alive: Logic Escape — Setup${RESET}\n"

# ── 1. Check prerequisites ────────────────────────────────────────────────────
echo -e "${BOLD}Checking prerequisites...${RESET}"

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "  ${RED}✕ $1 not found — please install it first${RESET}"
    exit 1
  else
    echo -e "  ${GREEN}✓ $1 found${RESET}"
  fi
}

check_cmd node
check_cmd npm

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo -e "  ${RED}✕ Node.js 20 or later is required (found $(node --version))${RESET}"
  exit 1
fi

if command -v mongod &>/dev/null || command -v mongosh &>/dev/null; then
  echo -e "  ${GREEN}✓ MongoDB command found${RESET}"
else
  echo -e "  ${YELLOW}⚠ MongoDB command not found — use MongoDB Atlas or start MongoDB before seeding${RESET}"
fi

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo -e "\n${BOLD}Installing server dependencies...${RESET}"
npm --prefix server install

echo -e "${BOLD}Installing client dependencies...${RESET}"
npm --prefix client install

# ── 3. Create .env files if missing ───────────────────────────────────────────
echo -e "\n${BOLD}Setting up environment files...${RESET}"

if [ ! -f server/.env ]; then
  if [ ! -f server/.env.example ]; then
    echo -e "  ${RED}✕ server/.env.example is missing${RESET}"
    exit 1
  fi
  cp server/.env.example server/.env
  # Generate strong random secrets for both access and refresh JWT tokens
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  sed -i.bak     -e "s/change-this-to-a-long-random-string/$JWT_SECRET/"     -e "s/change-this-to-another-long-random-string/$JWT_REFRESH_SECRET/"     server/.env
  rm -f server/.env.bak
  echo -e "  ${GREEN}✓ server/.env created with random JWT secrets${RESET}"
else
  echo -e "  ${YELLOW}⚠ server/.env already exists, skipping${RESET}"
fi

if [ ! -f client/.env ]; then
  if [ ! -f client/.env.example ]; then
    echo -e "  ${RED}✕ client/.env.example is missing${RESET}"
    exit 1
  fi
  cp client/.env.example client/.env
  echo -e "  ${GREEN}✓ client/.env created${RESET}"
else
  echo -e "  ${YELLOW}⚠ client/.env already exists, skipping${RESET}"
fi

# ── 4. Seed database ──────────────────────────────────────────────────────────
echo -e "\n${BOLD}Seeding clue database...${RESET}"
echo -e "  ${YELLOW}Note: MongoDB must be reachable using MONGODB_URI in server/.env${RESET}"

if (cd "$PROJECT_ROOT/server" && npm run seed); then
  echo -e "  ${GREEN}✓ Clues seeded successfully${RESET}"
else
  echo -e "  ${YELLOW}⚠ Clue seeding failed — check MongoDB and server/.env, then run 'cd server && npm run seed'${RESET}"
fi

# ── 5. Print instructions ─────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}✅ Setup complete!${RESET}\n"
echo -e "${BOLD}To start development servers:${RESET}"
echo -e ""
echo -e "  Terminal 1 — Server:"
echo -e "  ${GREEN}cd server && npm run dev${RESET}"
echo -e ""
echo -e "  Terminal 2 — Client:"
echo -e "  ${GREEN}cd client && npm run dev${RESET}"
echo -e ""
echo -e "  Then open: ${GREEN}http://localhost:5173${RESET}"
echo -e ""
echo -e "${BOLD}To set yourself as admin:${RESET}"
echo -e "  1. Register an account in the UI"
echo -e "  2. Get your player ID:"
echo -e "     ${GREEN}mongosh dead-or-alive --eval \"db.players.find({},{_id:1,username:1})\"${RESET}"
echo -e "  3. Add your ID to ${YELLOW}server/.env${RESET}:"
echo -e "     ${GREEN}ADMIN_IDS=your_player_id_here${RESET}"
echo -e "  4. Restart the server"
echo -e ""
echo -e "${BOLD}Or use Docker:${RESET}"
echo -e "  ${GREEN}docker compose up --build${RESET}"
echo -e ""
