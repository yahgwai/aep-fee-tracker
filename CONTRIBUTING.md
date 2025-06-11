# Contributing to AEP Fee Tracker

## Getting Started

### Initial Setup

1. Clone the repository
2. Run `npm install` to install all dependencies and set up git hooks
   - **Important**: Always run `npm install` first, not `npm install <package>`
   - This ensures git hooks are properly configured

### Git Hooks

This project uses git hooks to maintain code quality:
- **pre-commit**: Runs linting and formatting checks
- **pre-push**: Runs tests and build

The hooks are automatically installed when you run `npm install`.

If hooks aren't working:
```bash
# Manually run the setup
./.githooks/setup.sh

# Or reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
```

### Development Workflow

1. Create a feature branch from `develop`
2. Make your changes following TDD principles
3. Commit your changes (pre-commit hooks will run)
4. Push your branch (pre-push hooks will run)
5. Create a pull request

### Commit Messages

- Use conventional commit format (feat:, fix:, chore:, etc.)
- Do not include references to AI tools or assistants
- Keep messages clear and descriptive