#!/bin/bash
# deploy-web.sh — build + fix fonts + deploy to Vercel + alias qrforpay
# Usage: bash deploy-web.sh
set -e

echo "=== 1. Build web ==="
EXPO_PUBLIC_APP_BASE_URL=https://qrforpay.vercel.app \
  npx expo export -p web

echo "=== 2. Fix: copy icon fonts to _expo/static/fonts/ ==="
# Vercel excludes paths containing 'node_modules' — fonts exported by Metro
# land in dist/assets/node_modules/... and are NOT served by Vercel.
# Fix: copy them to dist/_expo/static/fonts/ which Vercel DOES serve.
mkdir -p dist/_expo/static/fonts

FONT_CSS=""
for TTF in dist/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/*.ttf; do
  FNAME=$(basename "$TTF")
  FAMILY="${FNAME%%.*}"   # e.g. "Ionicons" from "Ionicons.b4eb....ttf"
  cp "$TTF" "dist/_expo/static/fonts/$FNAME"
  FONT_CSS="${FONT_CSS}@font-face{font-family:'${FAMILY}';src:url('/_expo/static/fonts/${FNAME}') format('truetype');}"
done

echo "  Copied $(ls dist/_expo/static/fonts/*.ttf | wc -l | tr -d ' ') font files"

echo "=== 3. Inject @font-face CSS into index.html ==="
STYLE_TAG="<style>${FONT_CSS}</style>"
sed -i '' "s|</head>|${STYLE_TAG}</head>|" dist/index.html
echo "  Injected @font-face for all icon fonts"

echo "=== 4. Copy vercel.json + deploy ==="
cp vercel.json dist/
cd dist && npx vercel --prod --yes

echo ""
echo "=== 5. Add alias: qrforpay.vercel.app ==="
npx vercel alias qrforpay.vercel.app

echo ""
echo "=== Done! ==="
echo "Production URL: https://qrforpay.vercel.app"
echo "Verify fonts: curl -I https://qrforpay.vercel.app/_expo/static/fonts/Ionicons.*.ttf"
