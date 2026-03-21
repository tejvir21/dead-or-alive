#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Dead or Alive: Logic Escape — First-Run Setup Script
# Usage: bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

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
check_cmd mongod || check_cmd mongosh || true   # MongoDB optional if using Atlas

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo -e "\n${BOLD}Installing server dependencies...${RESET}"
cd server && npm install
cd ..

echo -e "${BOLD}Installing client dependencies...${RESET}"
cd client && npm install
cd ..

# ── 3. Create .env files if missing ───────────────────────────────────────────
echo -e "\n${BOLD}Setting up environment files...${RESET}"

if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  # Generate a random JWT secret
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  sed -i.bak "s/your-super-secret-jwt-key-change-in-production/$JWT_SECRET/" server/.env
  rm -f server/.env.bak
  echo -e "  ${GREEN}✓ server/.env created with random JWT_SECRET${RESET}"
else
  echo -e "  ${YELLOW}⚠ server/.env already exists, skipping${RESET}"
fi

if [ ! -f client/.env ]; then
  cp client/.env.example client/.env
  echo -e "  ${GREEN}✓ client/.env created${RESET}"
else
  echo -e "  ${YELLOW}⚠ client/.env already exists, skipping${RESET}"
fi

# ── 4. Seed database ──────────────────────────────────────────────────────────
echo -e "\n${BOLD}Seeding clue database...${RESET}"
echo -e "  ${YELLOW}Note: MongoDB must be running on localhost:27017${RESET}"

if cd server && node utils/seedClues.js 2>&1; then
  echo -e "  ${GREEN}✓ Clues seeded successfully${RESET}"
  cd ..
else
  echo -e "  ${YELLOW}⚠ Seed skipped (MongoDB may not be running yet — run 'npm run seed' later)${RESET}"
  cd ..
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
