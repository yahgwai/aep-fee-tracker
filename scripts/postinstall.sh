#!/bin/sh
# Postinstall script that skips git hooks setup in CI environments

# Check if we're in a CI environment
if [ "$CI" = "true" ] || [ "$CONTINUOUS_INTEGRATION" = "true" ] || [ "$GITHUB_ACTIONS" = "true" ]; then
  echo "CI environment detected - skipping git hooks setup"
  exit 0
fi

# Check if .githooks directory exists
if [ ! -d ".githooks" ]; then
  echo "Warning: .githooks directory not found - skipping git hooks setup"
  exit 0
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "Warning: Not in a git repository - skipping git hooks setup"
  exit 0
fi

# Run git hooks setup for local development
echo "Setting up git hooks..."
./.githooks/setup.sh