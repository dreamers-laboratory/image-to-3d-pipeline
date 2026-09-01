#!/usr/bin/env bash
# Controlled local evaluation: same renderer, cameras, lighting, and resolution for each GLB.
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 /absolute/path/to/mesh.glb candidate-name /absolute/path/to/output-root" >&2
  exit 64
fi

MESH_PATH="$1"
CANDIDATE="$2"
OUTPUT_ROOT="$3"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLENDER_BIN="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
PYTHON_BIN="${PYTHON_BIN:-$SCRIPT_DIR/../envs/triposr/bin/python}"
OUTPUT_DIR="$OUTPUT_ROOT/$CANDIDATE"

mkdir -p "$OUTPUT_DIR"
"$PYTHON_BIN" "$SCRIPT_DIR/inspect_glb.py" --input "$MESH_PATH" --output "$OUTPUT_DIR/mesh-facts.json"
"$BLENDER_BIN" --background --python "$SCRIPT_DIR/render_reconstruction_eval.py" -- --input "$MESH_PATH" --output "$OUTPUT_DIR/renders"
"$PYTHON_BIN" "$SCRIPT_DIR/make_reconstruction_contact_sheet.py" --input "$OUTPUT_DIR/renders/textured" --output "$OUTPUT_DIR/textured-contact-sheet.jpg" --title "$CANDIDATE — textured mesh (fixed inspection orbit)"
"$PYTHON_BIN" "$SCRIPT_DIR/make_reconstruction_contact_sheet.py" --input "$OUTPUT_DIR/renders/clay" --output "$OUTPUT_DIR/clay-contact-sheet.jpg" --title "$CANDIDATE — clay mesh (fixed inspection orbit)"
