# Contributing to AnchorPay

Thanks for contributing. AnchorPay is part of the **Stellar Wave Program** — merged PRs on labelled issues earn rewards paid in USDC via [Drips](https://drips.network/wave).

## Quick start

```bash
git clone https://github.com/chazed/anchorpay.git
cd anchorpay
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## How to contribute

1. Browse [open issues](../../issues) — look for `Stellar Wave` label for funded issues
2. Comment to express interest before starting work
3. Fork the repo and create a branch: `feat/issue-123-description`
4. Make your changes following the standards below
5. Open a PR referencing the issue: `Closes #123`
6. Maintainer reviews within 48 hours

## Standards

**Contracts (Rust)**
- Run `cargo test` before submitting
- New functions need at least one test in `#[cfg(test)]`
- No `unwrap()` in production paths — use typed errors

**Backend (TypeScript)**
- Run `npm test` in `/backend`
- Validate all inputs with Zod
- No secrets or API keys in code

**Frontend (TypeScript/React)**
- Components go in `src/components/`
- Use `cn()` from `lib/utils` for conditional classes
- Forms use `react-hook-form` + Zod resolvers
- Loading, error, and success states required for every async action

**General**
- Keep PRs focused — one issue per PR
- Commit messages: `feat:`, `fix:`, `chore:`, `docs:`
- No new dependencies without discussion in the issue first

## Complexity labels & points

| Label | Points | Examples |
|-------|--------|---------|
| `complexity:trivial` | 50–100 | Typo fix, add test, improve error message |
| `complexity:medium` | 150–300 | New bill type, UI improvement, API endpoint |
| `complexity:high` | 400–800 | Contract feature, security hardening, PWA |

## Reporting bugs

Open an issue with steps to reproduce, expected vs actual behaviour, network (testnet/mainnet), and browser/OS.

## Security

Do not open public issues for security vulnerabilities. Email `security@anchorpay.app` directly.
