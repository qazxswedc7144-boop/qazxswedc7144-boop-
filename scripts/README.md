# Script to find duplicate files by content hash

This repository includes a script to find duplicate files by calculating a SHA-256 hash for each file while skipping common build and environment directories.

How to run locally:

1. Checkout the branch remove-duplicate-files-20260624-1342
2. Run:

   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt  # none required by default
   python scripts/find_duplicates.py --repo-root . --exclude node_modules dist build __pycache__ --report report/duplicates_report.json

The script will produce report/duplicates_report.json with groups of duplicate files.
