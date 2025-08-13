#!/bin/sh
set -e

TPL="/docker-entrypoint.d/config.template.js"
DIST="/usr/share/nginx/html/dist"

# If template missing, create a default
if [ ! -f "$TPL" ]; then
  mkdir -p /docker-entrypoint.d
  cat > "$TPL" <<'EOF'
window.RUNTIME_CONFIG = { API_BASE: "${API_BASE}" };
EOF
fi

# Write config.js into dist and substitute env
cp "$TPL" "$DIST/config.js"
sed -i "s|\${API_BASE}|${API_BASE}|g" "$DIST/config.js" || true

# Ensure index.html loads config.js before the app bundle
INDEX="$DIST/index.html"
if [ -f "$INDEX" ] && ! grep -q "/config.js" "$INDEX"; then
  # insert before </head>
  sed -i 's#</head>#  <script src="/config.js"></script>\n</head>#' "$INDEX" || true
fi

