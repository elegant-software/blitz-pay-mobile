#!/usr/bin/env bash
set -euo pipefail

# Switch to main first
git checkout main

# Delete all local branches except main
git branch --format='%(refname:short)' \
  | grep -v '^main$' \
  | xargs -r git branch -D