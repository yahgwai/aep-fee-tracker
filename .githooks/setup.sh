#!/bin/sh
# Setup script to configure Git to use custom hooks

echo "Setting up Git hooks..."

# Configure Git to use .githooks directory
git config core.hooksPath .githooks

echo "Git hooks configured successfully!"
echo "Hooks location: .githooks/"
echo ""
echo "Available hooks:"
echo "  - pre-commit: Runs linting and formatting checks"
echo "  - pre-push: Runs tests and build"
echo ""

# Set up gh-safe wrapper
echo "Setting up gh-safe wrapper..."
if [ -f "./scripts/gh-safe.sh" ]; then
  # Create local bin directory if it doesn't exist
  mkdir -p "$HOME/.local/bin"
  
  # Check if gh-safe needs to be installed or updated
  NEEDS_INSTALL=false
  if [ ! -f "$HOME/.local/bin/gh-safe" ]; then
    NEEDS_INSTALL=true
  elif ! cmp -s "./scripts/gh-safe.sh" "$HOME/.local/bin/gh-safe"; then
    NEEDS_INSTALL=true
    echo "Updating gh-safe wrapper to latest version..."
  fi
  
  if [ "$NEEDS_INSTALL" = true ]; then
    # Copy gh-safe to local bin
    cp ./scripts/gh-safe.sh "$HOME/.local/bin/gh-safe"
    chmod +x "$HOME/.local/bin/gh-safe"
    echo "gh-safe wrapper installed successfully!"
  else
    echo "gh-safe wrapper already up to date"
  fi
  
  # Add alias to shell configuration files if not already present
  ALIAS_LINE='alias gh="$HOME/.local/bin/gh-safe"'
  ALIAS_ADDED=false
  
  # Check and add to .bashrc
  if [ -f "$HOME/.bashrc" ]; then
    if ! grep -q "alias gh=" "$HOME/.bashrc"; then
      echo "$ALIAS_LINE" >> "$HOME/.bashrc"
      echo "Added gh alias to .bashrc"
      ALIAS_ADDED=true
    fi
  fi
  
  # Check and add to .zshrc
  if [ -f "$HOME/.zshrc" ]; then
    if ! grep -q "alias gh=" "$HOME/.zshrc"; then
      echo "$ALIAS_LINE" >> "$HOME/.zshrc"
      echo "Added gh alias to .zshrc"
      ALIAS_ADDED=true
    fi
  fi
  
  echo "The 'gh' command will:"
  echo "  - Block merge operations"
  echo "  - Prevent AI/Claude references in content"
  
  if [ "$ALIAS_ADDED" = true ]; then
    echo ""
    echo "Restart your shell or run: source ~/.bashrc (or ~/.zshrc)"
  fi
else
  echo "Warning: gh-safe wrapper not found in project root"
fi

echo ""
echo "To disable hooks temporarily, use: git config core.hooksPath .git/hooks"
echo "To re-enable hooks, run this script again"