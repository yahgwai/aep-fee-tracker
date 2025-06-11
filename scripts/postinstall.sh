#!/bin/sh
# Postinstall script that skips git hooks setup in CI environments

# Check if we're in a CI environment
if [ "$CI" = "true" ] || [ "$CONTINUOUS_INTEGRATION" = "true" ] || [ "$GITHUB_ACTIONS" = "true" ]; then
  echo "CI environment detected - skipping git hooks setup"
  exit 0
fi

# Run git hooks setup for local development
./.githooks/setup.sh