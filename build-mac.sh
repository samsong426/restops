#!/usr/bin/env bash
set -e

APP_NAME="RestOps"
NODE_VERSION="22.14.0"  # LTS
ARCH=$(uname -m)         # arm64 or x86_64
NODE_ARCH=${ARCH/x86_64/x64}
NODE_DIR="node-v${NODE_VERSION}-darwin-${NODE_ARCH}"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIR}.tar.gz"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST="$SCRIPT_DIR/dist"
APP="$DIST/${APP_NAME}.app"
CONTENTS="$APP/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

echo "→ Cleaning dist/"
rm -rf "$DIST"
mkdir -p "$MACOS" "$RESOURCES"

# Download standalone Node.js binary (includes npm)
echo "→ Downloading Node.js ${NODE_VERSION} (${NODE_ARCH})..."
TMP=$(mktemp -d)
curl -sL "$NODE_URL" | tar -xz -C "$TMP"
NODE_EXTRACTED="$TMP/${NODE_DIR}"
cp "$NODE_EXTRACTED/bin/node" "$MACOS/node"
chmod +x "$MACOS/node"

# Copy app files (exclude dev/build artifacts)
echo "→ Copying app files..."
rsync -a \
  --exclude='.git' \
  --exclude='.claude' \
  --exclude='/dist' \
  --exclude='node_modules/.cache' \
  --exclude='build-mac.sh' \
  --exclude='launch.js' \
  "$SCRIPT_DIR/" "$RESOURCES/"

# Rebuild better-sqlite3 for the bundled Node.js version using its headers
echo "→ Rebuilding better-sqlite3 for Node.js ${NODE_VERSION}..."
NODE_GYP="$NODE_EXTRACTED/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js"
SQLITE_DIR="$RESOURCES/node_modules/better-sqlite3"
cd "$SQLITE_DIR"
"$MACOS/node" "$NODE_GYP" rebuild --release --nodedir="$NODE_EXTRACTED" 2>&1 | tail -5
cd "$SCRIPT_DIR"

rm -rf "$TMP"

# Write launcher script
cat > "$MACOS/${APP_NAME}" << 'LAUNCHER'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES="$DIR/../Resources"
NODE="$DIR/node"
PORT=3001

# Start server in background
cd "$RESOURCES"
"$NODE" server.js &
SERVER_PID=$!

# Wait for server then open browser
for i in $(seq 1 20); do
  if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    open "http://localhost:$PORT"
    break
  fi
  sleep 0.3
done

# Keep alive — quit app = stop server
wait $SERVER_PID
LAUNCHER
chmod +x "$MACOS/${APP_NAME}"

# Write Info.plist
cat > "$CONTENTS/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>           <string>RestOps</string>
  <key>CFBundleExecutable</key>     <string>RestOps</string>
  <key>CFBundleIdentifier</key>     <string>com.restops.app</string>
  <key>CFBundleVersion</key>        <string>1.0.0</string>
  <key>CFBundlePackageType</key>    <string>APPL</string>
  <key>LSMinimumSystemVersion</key> <string>12.0</string>
  <key>LSUIElement</key>            <false/>
</dict>
</plist>
PLIST

echo "→ Creating zip..."
cd "$DIST"
zip -qr "${APP_NAME}.zip" "${APP_NAME}.app"

SIZE=$(du -sh "$APP" | cut -f1)
echo ""
echo "✓ Done! dist/${APP_NAME}.app (${SIZE})"
echo "  Also zipped: dist/${APP_NAME}.zip — share this file"
echo ""
echo "  Double-click RestOps.app to launch."
echo "  The database (restaurant.db) lives in RestOps.app/Contents/Resources/"
