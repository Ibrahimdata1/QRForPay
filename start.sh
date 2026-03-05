#!/bin/bash
IP=$(ipconfig getifaddr en0)
sed -i '' "s|EXPO_PUBLIC_APP_BASE_URL=.*|EXPO_PUBLIC_APP_BASE_URL=http://$IP:8081|" .env
echo "✓ IP: $IP"
npx expo start --web --host lan
