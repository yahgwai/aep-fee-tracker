#!/bin/sh
# Script to ensure git hooks are properly configured
# Can be called from various git hooks or manually

# Check if hooks are already configured
CURRENT_HOOKS_PATH=$(git config core.hooksPath 2>/dev/null)

if [ "$CURRENT_HOOKS_PATH" != ".githooks" ]; then
  echo "Git hooks not configured - setting up now..."
  
  # Find the repository root
  GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
  if [ -z "$GIT_ROOT" ]; then
    echo "Error: Not in a git repository"
    exit 1
  fi
  
  # Change to repository root
  cd "$GIT_ROOT" || exit 1
  
  # Run the setup script
  if [ -f ".githooks/setup.sh" ]; then
    ./.githooks/setup.sh
  else
    echo "Error: .githooks/setup.sh not found"
    exit 1
  fi
fi