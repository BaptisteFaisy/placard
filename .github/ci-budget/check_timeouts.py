#!/usr/bin/env python3
"""Garde-fou budgétaire CI (règle user 2026-10-24) :
Tous les jobs de tous les workflows doivent déclarer timeout-minutes <= 5.
"""
import sys
from pathlib import Path

def main() -> int:
    workflows_dir = Path(__file__).resolve().parents[1] / "workflows"
    if not workflows_dir.is_dir():
        print("ci-budget: aucun dossier workflows", file=sys.stderr)
        return 1

    errors: list[str] = []
    for yml in workflows_dir.glob("*.yml"):
        content = yml.read_text(encoding="utf-8")
        lines = content.splitlines()
        in_jobs = False
        current_job = ""
        has_timeout = False

        for line in lines:
            if line.startswith("jobs:"):
                in_jobs = True
                continue
            if not in_jobs:
                continue

            # Un nouveau job commence par deux espaces + nom:
            if line.startswith("  ") and not line.startswith("    ") and line.strip().endswith(":"):
                if current_job and not has_timeout:
                    errors.append(f"{yml.name} -> job '{current_job}' sans timeout-minutes")
                current_job = line.strip()[:-1]
                has_timeout = False
                continue

            if current_job and "timeout-minutes:" in line:
                has_timeout = True
                val_str = line.split("timeout-minutes:")[1].strip()
                try:
                    val = int(val_str)
                    if val > 5:
                        errors.append(f"{yml.name} -> job '{current_job}' timeout {val} > 5 min")
                except ValueError:
                    pass

        if current_job and not has_timeout:
            errors.append(f"{yml.name} -> job '{current_job}' sans timeout-minutes")

    if errors:
        for err in errors:
            print(f"ERREUR ci-budget: {err}", file=sys.stderr)
        return 1

    print("ci-budget: tous les workflows sont conformes (<= 5 min)")
    return 0

if __name__ == "__main__":
    sys.exit(main())
