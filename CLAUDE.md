# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub API proxy server built with Hono framework and Deno runtime that proxies GitHub API requests through GitHub CLI (gh) commands. The server provides RESTful endpoints with OpenAPI 3.1.0 documentation.

## Development Commands

### Core Development Workflow
- `deno task start` - Start development server on port 8765 (auto-kills existing process)
- `deno fmt` - Format code (run before committing)
- `deno lint` - Lint code (run before committing)
- `deno test --allow-net --coverage=coverage` - Run tests with coverage
- `deno check src/server.ts` - Fast type-only check for CI

### Testing
- Primary testing: Use Deno's built-in test runner with `Deno.test`
- Alternative: `npm test` for Jest testing in Node.js environment
- Coverage target: 80% line coverage minimum
- Coverage reports: Generated in `coverage/` directory

### API Documentation
- Live API docs: Available at `http://localhost:8765/docs` when server is running

## Architecture & Key Patterns

### Core Structure
- **Server**: `src/server.ts` - Main Hono application setup with OpenAPI support
- **Routes**: `src/routes/` - Modular API endpoint definitions
- **GitHub Client**: `src/github/client.ts` - GitHub CLI integration abstraction
- **Bootstrap**: `start.ts` - Development server process management

### Technology Stack
- **Runtime**: Deno with TypeScript
- **Framework**: Hono v4.10.6 with OpenAPI support
- **Validation**: Zod schemas for request/response validation
- **Documentation**: OpenAPI 3.1.0 with Swagger UI
- **Testing**: Deno test runner (primary) with Jest fallback

### Data Flow
1. HTTP requests → Hono routes → Zod validation
2. GitHub API calls → GitHub CLI (gh) command execution
3. Response processing → Data transformation (owner object stripping)
4. Error handling → Structured error responses with `GitHubRequestError`

## Code Organization Standards

### File Naming & Structure
- Use lowercase-hyphen file naming (`user-routes.ts`)
- Place route logic in `src/routes/` directory
- Keep request handlers as pure functions returning Hono responses
- Export named modules for effective tree shaking

### Import Strategy
- ES modules with named exports only
- Import maps defined in `deno.json` handle both npm and jsr dependencies
- Update `deno.lock` when adding new dependencies via `deno cache src/server.ts`

## Testing Guidelines

### Test Organization
- Integration tests: Top-level `__tests__/` directory
- Unit tests: Place beside source files or in `lib/__tests__/`
- Mock dependencies with in-memory doubles (see `MockCommand` class in tests)

### Test Requirements
- Every route/middleware branch must have coverage
- Use descriptive test names: `Deno.test('GET /health returns 200', ...)`
- Test both success and error scenarios
- Mock GitHub CLI responses for consistent testing

## Development Workflow

### Before Committing
Always run: `deno fmt` → `deno lint` → `deno test --coverage`
Ensure CI passes locally before creating PRs.

### Commit Format
Follow Conventional Commits: `type(scope?): summary`
- Separate refactors from features
- Keep history clean and descriptive

## Security & Configuration

### Permissions
- Start with minimal permission flags
- Add `--allow-net`, `--allow-run`, `--allow-read`, `--allow-env` only as needed
- Current start command uses: `--allow-net --allow-run`

### Environment Variables
- Store secrets in ignored `.env` file
- Access via `Deno.env.get()` in configuration modules
- Never hardcode credentials

## Key Files for Understanding

**Must-read for new developers:**
1. `src/server.ts` - Application bootstrap and middleware setup
2. `src/routes/github.ts` - GitHub API route implementations
3. `src/github/client.ts` - GitHub CLI integration patterns
4. `start.ts` - Development workflow and process management
5. `__tests__/main.test.ts` - Testing patterns and examples

**Configuration:**
- `deno.json` - Tasks, import maps, compiler options
- `jest.config.cjs` - Jest testing fallback configuration
- `tsconfig.json` - TypeScript compiler settings

## API Endpoints

- `GET /` - Root endpoint with customizable greeting
- `GET /api/github/{owner}` - Get GitHub user profile
- `GET /api/github/{owner}/repos` - List user repositories
- `GET /api/github/{owner}/repos/{repo}` - Get repository details
- `GET /api/github/{owner}/repos/{repo}/branches` - List repository branches
- `GET /api/github/{owner}/repos/{repo}/prs` - List pull requests

All endpoints use Zod schema validation and return structured error responses.