#!/bin/bash
# Download Gruuv album artworks from Bandcamp
# Saves to the Gruuv folder in the Project Directory

DEST="$(cd "$(dirname "$0")/.." && pwd)/media/Gruuv/Artwork"
mkdir -p "$DEST"

# Album slugs and filenames
declare -a ALBUMS=(
  "forward-motion|Forward_Motion_Audiojack"
  "raw-manifesto|Raw_Manifesto_Qubiko"
  "more-or-less|More_Or_Less_Kody"
  "dizzy-heights|Dizzy_Heights_Audiojack_Aleya_Mae"
  "sky|Sky_Somersault"
  "90s-dreamin|90s_Dreamin_Audiojack"
  "coming-for-ya|Coming_For_Ya_nocapz"
  "release-yourself|Release_Yourself_Audiojack"
  "machine-house|Machine_House_Jordan_Peak"
  "become-clear|Become_Clear_Josh_Butler"
  "move-your-feet|Move_Your_Feet_PWE"
  "night-move|Night_Move_Deefo"
  "visions|Visions_Hauswerks"
)

# Humans is on a different subdomain
HUMANS_URL="https://audiojackmusic.bandcamp.com/album/humans"

echo "📀 Downloading Gruuv album artworks..."
echo "   Destination: $DEST"
echo ""

for entry in "${ALBUMS[@]}"; do
  IFS='|' read -r slug filename <<< "$entry"
  URL="https://gruuvlabel.bandcamp.com/album/$slug"
  echo "⏳ Fetching: $slug..."
  
  # Get the art ID from the page
  ART_URL=$(curl -s "$URL" | grep -oE 'https://f4\.bcbits\.com/img/a[0-9]+_10\.jpg' | head -1)
  
  if [ -z "$ART_URL" ]; then
    echo "   ⚠️  Could not find artwork for: $slug"
    continue
  fi
  
  echo "   📤 Downloading: $ART_URL"
  curl -s -o "$DEST/${filename}.jpg" "$ART_URL"
  echo "   ✅ Saved: ${filename}.jpg"
done

# Handle Humans separately (different subdomain)
echo "⏳ Fetching: humans (audiojackmusic.bandcamp.com)..."
ART_URL=$(curl -s "$HUMANS_URL" | grep -oE 'https://f4\.bcbits\.com/img/a[0-9]+_10\.jpg' | head -1)
if [ -n "$ART_URL" ]; then
  echo "   📤 Downloading: $ART_URL"
  curl -s -o "$DEST/Humans_Audiojack_Jake_The_Rapper.jpg" "$ART_URL"
  echo "   ✅ Saved: Humans_Audiojack_Jake_The_Rapper.jpg"
else
  echo "   ⚠️  Could not find artwork for: humans"
fi

echo ""
echo "✨ Done! Downloaded artworks:"
ls -la "$DEST"
