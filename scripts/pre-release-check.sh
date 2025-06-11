#!/bin/bash

# Pre-release checks to ensure repository is in a clean state

echo "Running pre-release checks..."

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "Error: There are uncommitted changes in the repository."
    echo "Please commit or stash all changes before releasing."
    git status --short
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Error: Releases must be done from the main branch."
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Check if local branch is up to date with remote
git fetch origin main --quiet
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    echo "Error: Local branch is not up to date with origin/main"
    echo "Please pull or push changes before releasing."
    exit 1
fi

echo "Pre-release checks passed!"