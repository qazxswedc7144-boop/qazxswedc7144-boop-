# Duplicate file cleaner script (Python)

# Usage:
#   python scripts/find_duplicates.py --repo-root . --exclude node_modules dist build __pycache__ --report report/duplicates_report.json

import argparse
import hashlib
import json
import os
from pathlib import Path

EXCLUDE_DIRS_DEFAULT = ["node_modules", "dist", "build", "__pycache__"]
EXCLUDE_FILES_DEFAULT = [".env"]


def hash_file(path, algo='sha256'):
    h = hashlib.new(algo)
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def find_files(root, exclude_dirs=None, exclude_files=None):
    exclude_dirs = set(exclude_dirs or [])
    exclude_files = set(exclude_files or [])
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        # skip excluded directories
        parts = Path(dirpath).parts
        if any(part in exclude_dirs for part in parts):
            continue
        for fn in filenames:
            if fn in exclude_files:
                continue
            full = os.path.join(dirpath, fn)
            # skip git internals
            if '.git' in Path(full).parts:
                continue
            files.append(full)
    return files


def group_by_hash(files):
    by_hash = {}
    for f in files:
        try:
            h = hash_file(f)
        except Exception as e:
            print(f"Skipping {f}: {e}")
            continue
        by_hash.setdefault(h, []).append(f)
    return by_hash


def write_report(report_path, duplicates):
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w', encoding='utf-8') as rf:
        json.dump(duplicates, rf, indent=2, ensure_ascii=False)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--repo-root', default='.', help='Repository root to scan')
    p.add_argument('--exclude', nargs='*', default=EXCLUDE_DIRS_DEFAULT, help='Directories to exclude')
    p.add_argument('--exclude-files', nargs='*', default=EXCLUDE_FILES_DEFAULT, help='Filenames to exclude')
    p.add_argument('--report', default='report/duplicates_report.json', help='Report output path')
    args = p.parse_args()

    files = find_files(args.repo_root, exclude_dirs=args.exclude, exclude_files=args.exclude_files)
    print(f"Found {len(files)} files to hash (after exclusions)")
    by_hash = group_by_hash(files)

    duplicates = {h: paths for h, paths in by_hash.items() if len(paths) > 1}
    print(f"Found {len(duplicates)} duplicate-hash groups")

    # prepare a human-readable report: for each hash list, pick the first as keeper, rest as duplicates
    report = []
    for h, paths in duplicates.items():
        report.append({
            'hash': h,
            'keeper': paths[0],
            'duplicates': paths[1:],
            'count': len(paths)
        })

    write_report(args.report, report)
    print(f"Wrote report to {args.report}")


if __name__ == '__main__':
    main()
