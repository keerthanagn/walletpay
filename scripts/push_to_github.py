#!/usr/bin/env python3
"""
WalletPay — Push to GitHub Helper Utility
Uses Dulwich (pure-Python Git) to push the local repository to GitHub.
Supports both interactive input and command-line arguments.
"""

import os
import sys
import getpass
from urllib.parse import urlparse, urlunparse

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    import dulwich.porcelain as p
except ImportError:
    import subprocess
    print("Installing dulwich...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "dulwich"])
    import dulwich.porcelain as p


def get_authenticated_url(repo_url, username=None, token=None):
    """Embed credentials into HTTPS URL if provided."""
    parsed = urlparse(repo_url)
    if not parsed.scheme.startswith('http'):
        return repo_url  # SSH or local URL

    if token:
        user_part = f"{username}:{token}" if username else token
        netloc = f"{user_part}@{parsed.hostname}"
        if parsed.port:
            netloc += f":{parsed.port}"
        return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
    return repo_url


def main():
    print("=" * 70)
    print("  WALLETPAY: PUSH TO GITHUB HELPER")
    print("=" * 70)

    # 1. Check or parse arguments
    if len(sys.argv) >= 2:
        repo_url = sys.argv[1].strip()
        token = sys.argv[2].strip() if len(sys.argv) >= 3 else None
        username = sys.argv[3].strip() if len(sys.argv) >= 4 else None
    else:
        print("\nEnter your GitHub repository details:")
        repo_url = input("GitHub Repository URL (e.g. https://github.com/USERNAME/REPO.git): ").strip()
        if not repo_url:
            print("Error: Repository URL cannot be empty.")
            return 1

        print("\nAuthentication:")
        print("Note: GitHub requires a Personal Access Token (PAT) with 'repo' scope.")
        token = input("GitHub Personal Access Token (leave empty if already authenticated or public): ").strip()
        username = input("GitHub Username (optional): ").strip() if token else None

    # 2. Add remote or update authenticated URL
    target_url = get_authenticated_url(repo_url, username, token)

    os.chdir(PROJECT_DIR)
    repo = p.open_repo(PROJECT_DIR)

    # Verify commits
    head = repo.head()
    print(f"\nLocal repository ready at commit: {head.decode()}")
    print("Pushing branch 'main' to remote...")

    try:
        # Push to remote
        p.push(
            repo=PROJECT_DIR,
            remote_location=target_url,
            refspecs=b"refs/heads/main:refs/heads/main"
        )
        print("\n" + "=" * 70)
        print("✓ SUCCESS! Repository pushed successfully to GitHub.")
        print(f"  Target: {repo_url}")
        print("  Branch: main")
        print("=" * 70 + "\n")
        return 0
    except Exception as e:
        print(f"\n✕ Push failed: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Ensure the repository exists on GitHub.")
        print("2. Ensure your Personal Access Token has the 'repo' scope enabled.")
        print("3. If using standard Git CLI, you can also run:")
        print(f"   git remote add origin {repo_url}")
        print("   git branch -M main")
        print("   git push -u origin main")
        return 1


if __name__ == '__main__':
    sys.exit(main())
