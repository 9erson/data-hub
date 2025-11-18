# Repository Guidelines

## Project Structure & Module Organization
- `main.ts` hosts the Hono app; keep route wiring here and extract logic into modules under `routes/` or `lib/` before importing back.
- `deno.json` defines tasks/import maps and `deno.lock` pins remote dependencies; update both when adding libs or permissions via `deno cache main.ts`.
- Tests can sit beside the source as `feature_test.ts` or live in a top-level `tests/` that mirrors the runtime structure.

## Build, Test, and Development Commands
- `deno task start` bootstraps the server with `--allow-net` for local development.
- `deno fmt main.ts lib/**/*.ts routes/**/*.ts tests/**/*.ts` applies consistent formatting; omit globs that do not exist yet.
- `deno lint` surfaces common mistakes, while `deno check main.ts` runs a fast type-only pass for CI.
- `deno test --allow-net --coverage=coverage` executes the suite and leaves LCOV data in `coverage/`; inspect with `deno coverage coverage --lcov`.

## Coding Style & Naming Conventions
- Use 2-space indentation, ES modules, and named exports so tree shaking stays effective.
- Favor lowercase-hyphen file names (`user-routes.ts`) and keep request handlers pure functions returning Hono responses.
- Always run `deno fmt` + `deno lint` before committing; both rely on the shared config in `deno.json`.

## Testing Guidelines
- Write cases with `Deno.test` and descriptive names such as `Deno.test('GET /health returns 200', …)`.
- Cover every route or middleware branch with at least one integration test; mock async dependencies with in-memory doubles.
- Gate merges on `deno test --coverage` hitting 80% line coverage or better.

## Commit & Pull Request Guidelines
- History currently follows Conventional Commits (`feat: add Hono hello world app…`), so stick to `type(scope?): summary`.
- Each PR must describe the change, note validation commands (`deno fmt`, `deno lint`, `deno test`), and link issues/screenshots when UI is involved.
- Separate refactors from features, keep CI green, and request review only after linting and tests pass locally.

## Security & Configuration Tips
- Start procs with the minimal permission flags; only add `--allow-read`, `--allow-env`, etc., when the feature requires them.
- Store secrets in an ignored `.env` file and read them through `Deno.env.get` inside a small `config.ts`, never hardcode credentials.
