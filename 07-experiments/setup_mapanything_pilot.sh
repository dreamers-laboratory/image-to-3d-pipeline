#!/usr/bin/env bash
# Run on a Linux GPU host. Everything written by this script stays under $PILOT.
set -euo pipefail

PILOT="${PILOT:-$HOME/3d-pilots/mapanything-pilot}"
REPO="$PILOT/map-anything"
export HF_HOME="$PILOT/hf-cache"
export HUGGINGFACE_HUB_CACHE="$HF_HOME/hub"
export PIP_CACHE_DIR="$PILOT/pip-cache"
export TMPDIR="$PILOT/tmp"
mkdir -p "$HF_HOME" "$PIP_CACHE_DIR" "$TMPDIR"

python3 -m venv "$PILOT/venv"
source "$PILOT/venv/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
python -m pip install -e "$REPO"
python -m pip freeze | sort > "$PILOT/pip-freeze.txt"
