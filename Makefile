.PHONY: format format-check build test test-coverage lint typecheck dev

# Format code using Prettier
format:
	pnpm format

# Check formatting (same as CI)
format-check:
	npx prettier --check "src/**/*.ts" "examples/**/src/**/*.ts"

# Build the project
build:
	pnpm build

# Run tests
test:
	pnpm test

# Run tests with coverage
test-coverage:
	pnpm test:coverage

# Run linting
lint:
	pnpm lint

# Type check
typecheck:
	pnpm typecheck

# Development mode
dev:
	pnpm dev

# Run all checks (format-check, typecheck, lint, test)
check: format-check typecheck lint test

# Fix all auto-fixable issues (format and lint fix)
fix:
	pnpm format
	pnpm lint --fix