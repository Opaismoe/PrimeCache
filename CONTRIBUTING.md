# Contributing to PrimeCache

Thank you for your interest in improving PrimeCache. This document explains how
we work together and what to expect when you contribute.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) first. By participating,
you agree to uphold it.

## Ways to contribute

- Report bugs or suggest features via [GitHub Issues](https://github.com/Opaismoe/PrimeCache/issues)
- Submit pull requests for fixes and small improvements
- Improve documentation (README, comments where they explain non-obvious behavior)
- Report security issues privately — see [SECURITY.md](SECURITY.md)

## Development setup

- **Node.js** 22+
- **pnpm** (version in root `package.json` as `packageManager`)
- **Docker** and Docker Compose for local integration (Browserless is external; see README)

From the repository root:

```bash
pnpm install
```

Copy `.env.example` to `.env` and set the variables described in the README.

## Commands

| Command | Purpose |
|--------|---------|
| `pnpm dev` | Backend in watch mode |
| `pnpm build` | Production build (backend + frontend) |
| `pnpm test` | All package tests (Vitest) |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm lint` | Biome check all packages |

Run tests for one package when iterating, for example:

```bash
pnpm --filter primecache-backend test
pnpm --filter primecache-frontend test
```

## Branching and pull requests

- Branch from `main`. Do not commit directly to `main`.
- Use short-lived branches: `feature/<short-description>` or `fix/<short-description>`.
- One focused pull request per branch.
- PR titles follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): summary`, `fix(scope): summary`, `test(scope): summary`, `docs: …`, `chore: …`, etc.

Before opening a PR, ensure `pnpm test`, `pnpm typecheck`, and `pnpm lint` pass locally.

## Tests and quality

- Prefer **test-driven development** for non-trivial behavior: add or extend tests that describe the desired outcome, then implement until they pass.
- Mock only external I/O (e.g. network, filesystem where appropriate); avoid mocking the unit under test unless the project’s existing tests establish that pattern.
- Match existing code style, naming, and structure in the files you touch.

## What makes a good issue

- **Bug**: What you expected, what happened, how to reproduce (environment, commands, minimal config if relevant).
- **Feature**: Problem you are solving, proposed behavior, and whether you are willing to implement it.

## Questions

If something is unclear, open a discussion question as an issue or ask in the PR
you are working on. Maintainers will respond when they can.

## License

By contributing, you agree that your contributions will be licensed under the
same license as the project (see the repository `LICENSE` file if present).
