#!/usr/bin/env bash
set -euo pipefail

FILE="products/api/sdks/python/coreidentity.py"

echo "[INFO] Applying timeout fixes to ${FILE}..."

# Fix 1: POST request timeout
sed -i 's/headers=self.headers\n\s*)/headers=self.headers,\n                timeout=30\n            )/g' "$FILE"

# Use Python for reliable multiline replacement
python3 << 'PYFIX'
import re

filepath = "products/api/sdks/python/coreidentity.py"

with open(filepath, "r") as f:
    content = f.read()

# Add timeout=30 before closing paren of requests calls missing it
fixed = re.sub(
    r'(requests\.(get|post)\([^)]+)(headers=self\.headers\s*\))',
    r'\1headers=self.headers,\n                timeout=30\n            )',
    content
)

with open(filepath, "w") as f:
    f.write(fixed)

print("[INFO] Timeouts applied successfully.")
PYFIX

echo "[INFO] Verifying fix..."
grep -n "timeout" "$FILE"

echo "[DONE] Re-run bandit to confirm clean:"
bandit -r products/api/sdks/python/coreidentity.py -f txt
