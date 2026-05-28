"""Promuove HEAD di staging private (marco-fire-tools-staging) → public (marco-fire-tools).

Workflow:
    Sviluppo: push abituale su `origin` (= staging private)
    Rilascio: `python scripts/release.py` → push a `public` (= marco-fire-tools)
              → GitHub Actions deploya GitHub Pages in ~2 min

Usage:
    python scripts/release.py                 # interactive, chiede conferma
    python scripts/release.py --yes           # skip prompt conferma
    python scripts/release.py --dry-run       # mostra cosa verrebbe rilasciato

Setup (one-time):
    git remote rename origin public
    git remote add origin <staging-private-url>

Pre-requisiti:
    - Entrambi i remote configurati: `origin` (staging) + `public`
    - Working tree pulito su staging
    - Branch corrente: main
"""
from __future__ import annotations

import argparse
import io
import subprocess
import sys
from pathlib import Path

# Force utf-8 stdout su Windows (cp1252 non sa fare →)
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parent.parent
STAGING_REMOTE = "origin"
PUBLIC_REMOTE = "public"
BRANCH = "main"
PUBLIC_URL = "https://marcofire-it.github.io/marco-fire-tools/"
ACTIONS_URL = "https://github.com/marcofire-it/marco-fire-tools/actions"


def run(cmd: list[str], check: bool = True, capture: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, cwd=str(REPO_ROOT), check=check,
        capture_output=capture, text=True,
    )


def must(cmd: list[str]) -> str:
    r = run(cmd)
    return r.stdout.strip()


def check_remotes() -> None:
    remotes = must(["git", "remote"]).split()
    for r in (STAGING_REMOTE, PUBLIC_REMOTE):
        if r not in remotes:
            sys.exit(
                f"FAIL: remote '{r}' non configurato.\n"
                f"      Setup richiesto:\n"
                f"        cd {REPO_ROOT}\n"
                f"        git remote rename origin public  (se origin punta gia' a public)\n"
                f"        git remote add origin <staging-private-url>"
            )


def check_clean_working_tree() -> None:
    status = must(["git", "status", "--porcelain"])
    if status:
        sys.exit(
            f"FAIL: working tree non pulito su staging:\n{status}\n"
            "      Commita o stash prima di rilasciare."
        )


def check_branch() -> None:
    branch = must(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    if branch != BRANCH:
        sys.exit(f"FAIL: branch corrente = '{branch}', atteso '{BRANCH}'.")


def fetch_remotes() -> None:
    print(f"[fetch] {STAGING_REMOTE} + {PUBLIC_REMOTE}...")
    run(["git", "fetch", STAGING_REMOTE, BRANCH], capture=False)
    run(["git", "fetch", PUBLIC_REMOTE, BRANCH], capture=False)


def staging_head() -> str:
    return must(["git", "rev-parse", f"{STAGING_REMOTE}/{BRANCH}"])


def public_head() -> str:
    return must(["git", "rev-parse", f"{PUBLIC_REMOTE}/{BRANCH}"])


def commits_to_release(staging_sha: str, public_sha: str) -> list[str]:
    """Lista commit presenti su staging ma non su public."""
    raw = must(["git", "log", "--oneline", f"{public_sha}..{staging_sha}"])
    return [line for line in raw.splitlines() if line.strip()]


def check_no_workflow_changes(public_sha: str, staging_sha: str) -> None:
    """
    Il PAT marcofire-it (probabile) non ha scope `workflow`. Se i commit da rilasciare
    toccano .github/workflows/*, GitHub rifiuta il push. Avviso prima di provare.
    """
    changed = must([
        "git", "diff", "--name-only", f"{public_sha}..{staging_sha}", "--",
        ".github/workflows/",
    ])
    if changed:
        print(
            "\n[WARN] I commit da rilasciare toccano .github/workflows/:\n"
            f"{changed}\n"
            "      Se il PAT non ha scope `workflow`, il push fallira'.\n"
            "      Soluzione: aggiungere quei file via UI GitHub al public repo.\n"
        )


def confirm(prompt: str) -> bool:
    try:
        ans = input(prompt + " [y/N]: ").strip().lower()
    except EOFError:
        return False
    return ans in ("y", "yes", "s", "si")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--yes", action="store_true", help="skip conferma interattiva")
    ap.add_argument("--dry-run", action="store_true", help="mostra cosa verrebbe rilasciato, senza pushare")
    args = ap.parse_args()

    print(f"=== RELEASE marco-fire-tools ===")
    print(f"  repo locale: {REPO_ROOT}")

    check_remotes()
    check_clean_working_tree()
    check_branch()
    fetch_remotes()

    s_sha = staging_head()
    p_sha = public_head()
    commits = commits_to_release(s_sha, p_sha)

    print(f"\n  staging HEAD: {s_sha[:8]}")
    print(f"  public  HEAD: {p_sha[:8]}")
    print(f"  delta:        {len(commits)} commit")

    if not commits:
        print("\n[done] Niente da rilasciare. Staging e public sono allineati.")
        return 0

    print(f"\nCommit da rilasciare (staging → public):")
    for c in commits:
        print(f"  + {c}")

    check_no_workflow_changes(p_sha, s_sha)

    if args.dry_run:
        print("\n[dry-run] STOP. Niente push effettuato.")
        return 0

    if not args.yes:
        if not confirm("\nProcedo con push a public?"):
            print("[abort] Niente push effettuato.")
            return 1

    print(f"\n[push] {STAGING_REMOTE}/{BRANCH} → {PUBLIC_REMOTE}/{BRANCH}")
    # Push lo SHA di staging come ref del branch public/main
    push_result = run(
        ["git", "push", PUBLIC_REMOTE, f"{s_sha}:refs/heads/{BRANCH}"],
        check=False, capture=True,
    )
    if push_result.returncode != 0:
        print(push_result.stdout)
        print(push_result.stderr, file=sys.stderr)
        sys.exit(f"FAIL: push a {PUBLIC_REMOTE} fallito (exit {push_result.returncode})")

    print(push_result.stderr.strip() or push_result.stdout.strip())

    print(f"\n[done] Rilasciato {len(commits)} commit a public.")
    print(f"  Actions:  {ACTIONS_URL}")
    print(f"  Live:     {PUBLIC_URL}")
    print(f"  Deploy ~2 min, ricarica la URL Live per verificare.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
