#!/usr/bin/env bash
# Makes every public package trust this repository's release.yml for npm trusted
# publishing (OIDC), so CI publishes with no token (SR-BUILD decision 9). Run once by
# the decider, after the package exists on npm: `npm trust` needs npm 12 and an
# interactive login (2FA). Usage: scripts/npm-trust.sh [--dry-run]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
for f in packages/*/package.json; do
  name=$(node -p "const p = require('./$f'); p.private ? '' : p.name")
  [ -n "$name" ] || continue
  echo "→ $name"
  npx -y npm@12 trust github "$name" --file release.yml --repo arpitarya/sheetpane --allow-publish -y "$@"
done
