#!/usr/bin/env bash
# Run on a Linux GPU host. Everything written by this script stays under $PILOT.
set -euo pipefail

PILOT="${PILOT:-$HOME/3d-pilots/trellis2-pilot}"
REPO="$PILOT/TRELLIS.2"
export HF_HOME="$PILOT/hf-cache"
export HUGGINGFACE_HUB_CACHE="$HF_HOME/hub"
export PIP_CACHE_DIR="$PILOT/pip-cache"
export TMPDIR="$PILOT/tmp"
mkdir -p "$HF_HOME" "$PIP_CACHE_DIR" "$TMPDIR" "$PILOT/build-sources"

python3 -m venv "$PILOT/venv"
source "$PILOT/venv/bin/activate"
python -m pip install --upgrade pip setuptools wheel
python -m pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
python -m pip install imageio imageio-ffmpeg tqdm easydict opencv-python-headless ninja trimesh transformers gradio==6.0.1 tensorboard pandas lpips zstandard pillow-simd kornia timm psutil
python -m pip install 'git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8'

git clone --depth 1 -b v0.4.0 https://github.com/NVlabs/nvdiffrast.git "$PILOT/build-sources/nvdiffrast"
python -m pip install "$PILOT/build-sources/nvdiffrast" --no-build-isolation
git clone --depth 1 -b renderutils https://github.com/JeffreyXiang/nvdiffrec.git "$PILOT/build-sources/nvdiffrec"
python -m pip install "$PILOT/build-sources/nvdiffrec" --no-build-isolation
git clone --recursive --depth 1 https://github.com/JeffreyXiang/CuMesh.git "$PILOT/build-sources/CuMesh"
python -m pip install "$PILOT/build-sources/CuMesh" --no-build-isolation
git clone --recursive --depth 1 https://github.com/JeffreyXiang/FlexGEMM.git "$PILOT/build-sources/FlexGEMM"
python -m pip install "$PILOT/build-sources/FlexGEMM" --no-build-isolation
python -m pip install "$REPO/o-voxel" --no-build-isolation
python -m pip install flash-attn==2.7.3 --no-build-isolation
python -m pip freeze | sort > "$PILOT/pip-freeze.txt"
