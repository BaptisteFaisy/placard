#!/usr/bin/env python3
"""Garde-fou du concours Kiroween :
1. Le dossier /.kiro doit exister à la racine du dépôt.
2. Aucune ligne de .gitignore ne doit cibler ou masquer .kiro.
3. Le fichier LICENSE doit exister et déclarer MIT.
4. Le fichier KIRO_JOURNAL.md doit être présent et non vide.
Sort en code 0 si conforme, 1 sinon.
"""
import sys
from pathlib import Path

def main() -> int:
    # La racine est le dossier qui contient .github/ et .kiro/
    root = Path(__file__).resolve().parents[2]
    errors: list[str] = []

    kiro_dir = root / ".kiro"
    if not kiro_dir.is_dir():
        errors.append("Le dossier /.kiro est absent de la racine.")

    gitignore = root / ".gitignore"
    if gitignore.is_file():
        for i, line in enumerate(gitignore.read_text(encoding="utf-8").splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if ".kiro" in stripped:
                errors.append(f".gitignore ligne {i} mentionne '.kiro' : {stripped}")

    license_file = root / "LICENSE"
    if not license_file.is_file():
        errors.append("Fichier LICENSE absent.")
    else:
        content = license_file.read_text(encoding="utf-8")
        if "MIT License" not in content:
            errors.append("LICENSE ne mentionne pas 'MIT License'.")

    journal = root / "KIRO_JOURNAL.md"
    if not journal.is_file() or journal.stat().st_size < 100:
        errors.append("KIRO_JOURNAL.md est absent ou trop court (< 100 octets).")

    if errors:
        for err in errors:
            print(f"ERREUR kiro-guard: {err}", file=sys.stderr)
        return 1

    print("kiro-guard: conformite OK (/.kiro, .gitignore, LICENSE, KIRO_JOURNAL.md)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
