#!/usr/bin/env sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo_root"

npm audit
npm run typecheck
npm test
npm run test:appliance
npm run build
