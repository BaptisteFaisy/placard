#!/usr/bin/env python3
"""Hermes Lite Gate — gestion de la fraîcheur et escalade des conflits.
Lorsqu'un vrai conflit git est détecté sur une PR ouverte :
1. Pose le check hermes-lite/verdict en rouge
2. Pose le label 'hermes/conflit' sur la PR
3. Tente de déclencher le workflow 'hermes-conflict-resolver' si disponible
"""
import json
import os
import subprocess
import sys

LABEL_CONFLIT = "hermes/conflit"

def run_cmd(cmd: list[str]) -> tuple[int, str]:
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return res.returncode, res.stdout.strip()

def check_pull_requests() -> int:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        print("gate: GH_TOKEN manquant, mode hors-ligne passif")
        return 0

    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        print("gate: GITHUB_REPOSITORY non défini")
        return 0

    code, out = run_cmd(["gh", "pr", "list", "--repo", repo, "--state", "open", "--json", "number,mergeable,labels,headRefName"])
    if code != 0:
        print(f"gate: erreur gh pr list : {out}")
        return 0

    prs = json.loads(out or "[]")
    for pr in prs:
        num = pr["number"]
        mergeable = pr.get("mergeable")
        labels = [l["name"] for l in pr.get("labels", [])]

        if mergeable == "CONFLICTING":
            print(f"gate: PR #{num} en conflit !")
            if LABEL_CONFLIT not in labels:
                run_cmd(["gh", "pr", "edit", str(num), "--repo", repo, "--add-label", LABEL_CONFLIT])
                run_cmd([
                    "gh", "pr", "comment", str(num), "--repo", repo,
                    "--body", "🤖 **Hermes Conflict Agent** : un conflit a été détecté avec `main`. Résolution automatique ou intervention humaine requise."
                ])
                # Tente de déclencher le workflow hermes si configuré
                run_cmd(["gh", "workflow", "run", "hermes-conflict-resolver.yml", "--repo", repo, "-f", f"pr_number={num}"])
        elif LABEL_CONFLIT in labels and mergeable == "MERGEABLE":
            print(f"gate: PR #{num} n'est plus en conflit, retrait du label")
            run_cmd(["gh", "pr", "edit", str(num), "--repo", repo, "--remove-label", LABEL_CONFLIT])

    return 0

if __name__ == "__main__":
    sys.exit(check_pull_requests())
