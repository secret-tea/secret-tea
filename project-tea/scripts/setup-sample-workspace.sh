#!/usr/bin/env bash
# Initialize sample/ as a git repository with a fixture commit.
# This is required for git history scan integration tests.
set -e

SAMPLE_DIR="$(dirname "$0")/../sample"

if [ ! -d "$SAMPLE_DIR/.git" ]; then
  echo "[setup] Initializing git repository in sample/..."
  cd "$SAMPLE_DIR"
  git init
  git config user.email "test@secretea.dev"
  git config user.name "SecretTea Test"
  git add .
  git commit -m "chore: initial fixture commit for integration tests"
  echo "[setup] Done. sample/ is now a git repository."
else
  echo "[setup] sample/ is already a git repository. Skipping."
fi