# Contributing

## Setup

After cloning the repository, run:

```bash
./scripts/postinstall.sh
```

This will set up the git hooks that enforce code quality standards.

## Git Hooks

The project uses git hooks for:
- **pre-commit**: Linting and commit message validation
- **pre-push**: Tests and build verification

If hooks aren't working, just run `./scripts/postinstall.sh` again.