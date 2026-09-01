#!/usr/bin/env bash
# Clone the third-party image-to-3D tools at the exact commits used in this
# evaluation. They are cloned into tools/vendor/ (gitignored) rather than
# vendored in this repository because each carries its own license, which you
# accept when you fetch it:
#
#   TRELLIS          MIT
#   TripoSR          MIT
#   stable-fast-3d   Stability AI Community License
#   Hunyuan3D-2      Tencent Hunyuan community license, territorially restricted
#
# Review each license before use. The Stability AI and Tencent licenses carry
# commercial-use and territorial restrictions respectively.
set -euo pipefail

VENDOR_DIR="$(cd "$(dirname "$0")" && pwd)/tools/vendor"
mkdir -p "$VENDOR_DIR"

clone_pinned() {
  local url="$1" sha="$2" dir="$VENDOR_DIR/$3"
  if [[ -d "$dir/.git" ]]; then
    echo "$3 already present, skipping"
    return
  fi
  git clone "$url" "$dir"
  git -C "$dir" checkout --detach "$sha"
}

clone_pinned https://github.com/microsoft/TRELLIS.git          442aa1e1afb9014e80681d3bf604e8d728a86ee7 TRELLIS
clone_pinned https://github.com/VAST-AI-Research/TripoSR.git   107cefdc244c39106fa830359024f6a2f1c78871 TripoSR
clone_pinned https://github.com/Stability-AI/stable-fast-3d.git ff21fc491b4dc5314bf6734c7c0dabd86b5f5bb2 stable-fast-3d
clone_pinned https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git f8db63096c8282cb27354314d896feba5ba6ff8a Hunyuan3D-2

echo "Done. Tools are in $VENDOR_DIR"
