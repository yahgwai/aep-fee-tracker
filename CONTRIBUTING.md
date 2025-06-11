# Contributing to AEP Fee Tracker

## Getting Started

### Initial Setup

After cloning the repository, you **must** run these commands in order:

```bash
# 1. Install all dependencies (this also sets up git hooks)
npm install

# 2. Verify git hooks are installed
git config core.hooksPath
# Should output: .githooks
```

⚠️ **Important**: Always run `npm install` before creating any branches or making commits. This ensures git hooks are properly configured to maintain code quality.

### Git Hooks

This project uses git hooks to enforce code quality and standards:

- **pre-commit**: 
  - Runs linting and formatting checks
  - Validates commit messages
  - Prevents commits with AI/Claude references
  
- **pre-push**: 
  - Runs all tests
  - Runs the build process
  - Ensures code is ready for review

### If Git Hooks Aren't Working

If you accidentally made commits before setting up hooks:

```bash
# Check if hooks are configured
git config core.hooksPath

# If not set or incorrect, run:
./.githooks/setup.sh

# Or do a clean install:
rm -rf node_modules package-lock.json
npm install
```

### Development Workflow

1. **Always start with `npm install`** after cloning
2. Create a feature branch from `develop`
3. Follow TDD practices:
   - Write failing tests first
   - Implement minimal code to pass tests
   - Refactor for clarity
4. Commit your changes (pre-commit hooks will validate)
5. Push your branch (pre-push hooks will run tests)
6. Create a pull request

### Commit Message Guidelines

- Use conventional commit format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `test:` for test additions/changes
  - `chore:` for maintenance tasks
  - `refactor:` for code refactoring

- Keep messages clear and descriptive
- Reference issue numbers when applicable (e.g., "Resolves #123")
- Do NOT include references to AI tools or assistants

### Code Style

- TypeScript strict mode is enforced
- Follow existing patterns in the codebase
- All functions must have proper types (no `any`)
- Tests are required for all new functionality

### Testing

- Tests use real file operations (no mocking file system)
- Follow the existing test structure
- Aim for comprehensive coverage of:
  - Success cases
  - Error cases
  - Edge cases
  - Validation

### Troubleshooting

**"Permission denied" when running git commands**
- The gh-safe wrapper might be blocking certain operations
- This is intentional to prevent accidental merges

**Tests failing locally but not in CI**
- Ensure you're in a clean directory
- Run `npm run clean` before testing

**Commits rejected due to message validation**
- Check for AI/Claude references
- Ensure conventional commit format