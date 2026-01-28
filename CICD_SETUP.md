# CI/CD Setup Guide

This document explains the CI/CD infrastructure and how to configure it in GitHub.

## Overview

The project uses **GitHub Actions** for CI/CD with separate workflows for:
- **Extension CI/CD** - Browser extension testing and building
- **Backend CI/CD** - Python backend testing and validation

## Current Infrastructure

### 1. GitHub Actions Workflows

#### Extension CI/CD (`.github/workflows/extension-ci.yml`)
**Triggers:**
- Push to `main` branch (when extension or shared code changes)
- Pull requests to `main` (when extension or shared code changes)

**Pipeline steps:**
- Installs Node.js dependencies
- Runs TypeScript type checking (`npm run type-check`)
- Runs Vitest tests (`npm test`)
- Builds the extension (`npm run build`)
- Uploads build artifacts (available for 7 days)
- Reports bundle size in workflow summary

#### Backend CI/CD (`.github/workflows/backend-ci.yml`)
**Triggers:**
- Push to `main` branch (when backend or shared code changes)
- Pull requests to `main` (when backend or shared code changes)

**Pipeline steps:**
- Installs Python dependencies
- Runs linting with Ruff
- Runs type checking with mypy
- Runs unit tests with pytest (with coverage)
- Runs integration tests (Supabase/Pinecone)
- Uploads coverage reports to Codecov
- Tests API startup

### 2. Test Infrastructure

#### Backend Tests (`backend/backend_tests/`)
```
backend_tests/
├── conftest.py              # Pytest fixtures
├── unit/
│   ├── test_api_health.py   # API endpoint tests
│   └── test_schemas.py      # Schema validation tests
└── integration/
    ├── test_supabase_connection.py
    └── test_pinecone_connection.py
```

**Configuration files:**
- `pytest.ini` - Pytest configuration
- `pyproject.toml` - Ruff, mypy configuration
- `requirements-dev.txt` - Test dependencies

**Run tests locally:**
```bash
cd backend
pip install -r requirements-dev.txt

# Run all tests
pytest

# Run only unit tests
pytest backend_tests/unit/ -v

# Run with coverage
pytest --cov=app --cov-report=html
```

#### Extension Tests (`extension/src/`)
```
src/
├── tests/
│   └── setup.ts             # Test setup & Chrome API mocks
├── lib/
│   └── db.test.ts          # IndexedDB tests
├── content/
│   └── content-script.test.ts
└── background/
    └── service-worker.test.ts
```

**Configuration files:**
- `vitest.config.ts` - Vitest configuration
- Test scripts added to `package.json`

**Run tests locally:**
```bash
cd extension
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## Configuration Requirements

### 1. Install Dependencies

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
```

**Extension:**
```bash
cd extension
npm install
```

### 2. Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Click **"New repository secret"** and add the following:

#### Required Secrets for Backend Integration Tests

| Secret Name | Description | Example |
|------------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGc...` |
| `PINECONE_API_KEY` | Pinecone API key | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `PINECONE_INDEX_NAME` | Pinecone index name | `knowledge-companion` |

**Procedure for adding secrets:**
1. Click "New repository secret"
2. Enter the name (e.g., `SUPABASE_URL`)
3. Paste the value
4. Click "Add secret"

**Note:** Integration tests will be skipped if secrets are not configured and will not cause build failures.

### 3. Enable GitHub Actions

1. Go to your repository on GitHub
2. Click the **"Actions"** tab
3. If prompted, click **"I understand my workflows, go ahead and enable them"**

### 4. Verify Workflow Execution

**Option A: Push to trigger workflows**
```bash
git add .
git commit -m "chore: add CI/CD workflows and test infrastructure"
git push origin feat/local-reading-storage
```

**Option B: Create a pull request**
- Create a PR from your branch to `main`
- Workflows will run automatically
- Check the "Checks" tab in the PR to see results

### 5. Monitor Workflow Results

1. Go to the **"Actions"** tab in your GitHub repository
2. Click on a workflow run to see details
3. Click on individual jobs to see logs
4. Download build artifacts from the workflow summary

## Tool Specifications

### Testing Tools

#### **Vitest** (Extension)
- **Description:** Fast unit test framework for Vite projects
- **Rationale:** Native ESM support, fast execution, comprehensive TypeScript support
- **Capabilities:** Watch mode, UI mode, coverage reports

#### **pytest** (Backend)
- **Description:** Python testing framework
- **Rationale:** Industry standard, comprehensive fixtures, async support
- **Capabilities:** Markers, parametrization, coverage integration

#### **@testing-library/react** (Extension)
- **Description:** React component testing utilities
- **Rationale:** Encourages testing user behavior over implementation details
- **Capabilities:** Query utilities, async utilities, user event simulation

#### **happy-dom** (Extension)
- **Description:** Lightweight DOM implementation for testing
- **Rationale:** Superior performance compared to jsdom, sufficient for standard test scenarios
- **Capabilities:** Web APIs, DOM manipulation, event handling

### Linting & Type Checking

#### **Ruff** (Backend)
- **Description:** Fast Python linter (written in Rust)
- **Rationale:** 10-100x faster than alternatives, consolidates multiple tools
- **Capabilities:** Auto-fix, import sorting, extensive rule set

#### **mypy** (Backend)
- **Description:** Static type checker for Python
- **Rationale:** Catches type errors before runtime
- **Capabilities:** Gradual typing, type inference

### CI/CD Tools

#### **GitHub Actions**
- **Description:** CI/CD platform integrated with GitHub
- **Rationale:** Free for public repositories, straightforward configuration, extensive ecosystem
- **Capabilities:** Matrix builds, caching, artifacts, secrets management

#### **Codecov** (Optional)
- **Description:** Code coverage reporting service
- **Rationale:** Visualizes coverage trends, provides PR comments with coverage changes
- **Setup:** Sign up at codecov.io and link your repository

## Workflow Behavior

### Path-Based Triggering
Workflows only run when relevant files change:
- Extension workflow: `extension/**`, `shared/**`
- Backend workflow: `backend/**`, `shared/**`

This saves CI minutes and speeds up feedback.

### Artifact Retention
- Extension builds are kept for **7 days**
- Download from workflow summary page
- Useful for testing builds without running locally

### Integration Test Handling
- Integration tests continue on error (`continue-on-error: true`)
- Won't fail the build if external services are down
- Check logs to see if they passed

## Future Enhancements

### Recommended Extensions

1. **Add ESLint to extension**
   ```bash
   cd extension
   npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
   ```

2. **Add pre-commit hooks with Husky**
   ```bash
   cd extension
   npm install -D husky lint-staged
   npx husky init
   ```

3. **Set up Codecov**
   - Sign up at https://codecov.io
   - Add `CODECOV_TOKEN` to GitHub secrets
   - Get coverage badges for README

4. **Add more test cases**
   - API endpoint tests (when endpoints are implemented)
   - React component tests (popup, sidepanel)
   - E2E tests with Playwright (optional)

## Troubleshooting

### Workflow fails with "npm ci" error
- Delete `package-lock.json` and run `npm install` locally
- Commit the updated lockfile

### Integration tests fail
- Check if secrets are configured correctly
- Verify external services (Supabase, Pinecone) are accessible
- Integration tests are marked as `continue-on-error: true` so they won't block PRs

### Type errors in tests
- Run `npm install` to install vitest dependencies
- Ensure `@types/chrome` is installed for Chrome API types

### Backend tests fail locally
- Activate virtual environment: `source venv/bin/activate`
- Install dev dependencies: `pip install -r requirements-dev.txt`
- Check Python version: `python --version` (should be 3.11+)

## Summary

This project currently includes:

- **GitHub Actions workflows** for extension and backend CI/CD pipelines
- **Test infrastructure** configured with pytest and vitest
- **Initial test cases** covering critical functionality paths
- **Configuration files** for all testing and linting tools
- **Path-based triggering** to optimize CI execution

**Required action:** Configure GitHub secrets to enable integration tests in CI environment.
