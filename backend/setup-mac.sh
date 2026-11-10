#!/bin/bash
# Downloads or updates the Here & Now backend without git pull.
# Preserves your .env secrets and never sends them anywhere.
set -euo pipefail
DIR="$HOME/HereNowBackend"
BASE="https://raw.githubusercontent.com/Joar-Rinaldo-Roos/skane-green-access/main/backend"
mkdir -p "$DIR"
for FILE in server.mjs package.json .env.example; do
  curl --fail --silent --show-error --location "$BASE/$FILE" --output "$DIR/$FILE.new"
  mv "$DIR/$FILE.new" "$DIR/$FILE"
done
if [ ! -f "$DIR/.env" ]; then
  cp "$DIR/.env.example" "$DIR/.env"
  chmod 600 "$DIR/.env"
  echo "Created private settings file: $DIR/.env"
else
  echo "Existing .env preserved: $DIR/.env"
fi
echo ""
echo "Open your settings: open -e \"$DIR/.env\""
echo "Start the backend: cd \"$DIR\" && npm start"
echo "Re-run this setup script to update backend code later (then restart npm start)."
