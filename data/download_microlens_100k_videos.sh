#!/bin/sh
set -eu

BASE_URL="${1:?Please provide BASE_URL, e.g. https://[domain]/MicroLens-100k-Dataset}"
OUT_DIR="${2:-MicroLens-100k-videos}"
PREFIX="MicroLens-100k_videos"

mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

echo "[INFO] BASE_URL=$BASE_URL"
echo "[INFO] OUT_DIR=$(pwd)"
echo "[INFO] PREFIX=$PREFIX"

download_if_exists() {
  url="$1"
  out="$2"

  if wget --spider -q "$url"; then
    echo "[DOWNLOADING] $url"
    wget -c "$url" -O "$out"
    return 0
  else
    return 1
  fi
}

ZIP_URL="${BASE_URL%/}/${PREFIX}.zip"
if download_if_exists "$ZIP_URL" "${PREFIX}.zip"; then
  echo "[INFO] Found main zip: ${PREFIX}.zip"
else
  echo "[ERROR] Main zip not found: $ZIP_URL"
  exit 1
fi

i=1
found_any=0

while :; do
  part=$(printf "%s.z%02d" "$PREFIX" "$i")
  url="${BASE_URL%/}/$part"

  if download_if_exists "$url" "$part"; then
    found_any=1
    i=$((i + 1))
  else
    break
  fi
done

if [ "$found_any" -eq 0 ]; then
  echo "[WARN] No split parts found after main zip."
else
  echo "[INFO] Download stopped at first missing part."
fi

echo "[DONE] Finished. Keep all parts in the same directory, then extract from the .zip file."
