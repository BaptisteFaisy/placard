#!/usr/bin/env bash
# Recette automatisée C.17 — Placard (Kiroween 2026)
set -euo pipefail

export PATH="/home/baptiste/.local/opt/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== Recette C.17 — Placard ==="

echo "[1/4] Vérification conformité Kiroween & budget CI (<= 5 min)..."
python3 .github/kiro/check_kiro.py
python3 .github/ci-budget/check_timeouts.py
echo "  -> OK"

echo "[2/4] Typage strict, lint (<500l / <50l par fn) et suite de tests complète..."
pnpm typecheck
pnpm lint
pnpm vitest run packages/integration
echo "  -> OK"

echo "[3/4] Auto-scan du dépôt Placard lui-même..."
pnpm exec tsx --tsconfig tsconfig.node.json packages/cli/src/main.ts scan . --json
echo "  -> OK"

echo "[4/4] Construction du site statique de démonstration..."
pnpm --filter @placard/web build
test -f packages/web/dist/index.html
test -f packages/web/dist/demo-report.json
echo "  -> OK"

echo "=== RECETTE C.17 : TOUS LES POINTS SONT VERTS ==="
