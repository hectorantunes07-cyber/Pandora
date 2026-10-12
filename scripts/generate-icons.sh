#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Inkscape handles SVG gradients; ImageMagick builds a Windows multi-image ICO.
inkscape build/icon.svg --export-type=png --export-filename=build/icon.png --export-width=512 --export-height=512
magick build/icon.png -define icon:auto-resize=256,128,64,48,32,24,16 build/icon.ico
