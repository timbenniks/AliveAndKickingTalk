#!/bin/bash
set -euo pipefail
# The combined app includes the original notes-only Neural DSP fallback.
exec bash "$(dirname "$0")/build-rig.sh" "$@"
