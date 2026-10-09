# Drips Wave Program Setup

AnchorPay participates in the [Stellar Wave Program](https://drips.network/wave) — a recurring bounty program where contributors earn USDC rewards for merged PRs.

## For Maintainers

### Enrolling the repo

1. Go to [drips.network/wave](https://drips.network/wave)
2. Connect your Ethereum wallet
3. Install the Drips Wave GitHub App on this repo
4. Submit the repo for review — ensure it meets Stellar ecosystem relevance criteria

### Labelling issues for Wave

Issues eligible for rewards must have the `Stellar Wave` label applied via the Drips Wave dashboard. Complexity labels map to point values:

| Label | Points | Approx. reward |
|-------|--------|----------------|
| `complexity:trivial` | 50–100 | ~$25–50 |
| `complexity:medium` | 150–300 | ~$75–150 |
| `complexity:high` | 400–800 | ~$200–400 |

### Releasing payment

After a PR is merged and VTPass confirms delivery:
1. The Soroban contract automatically releases USDC from escrow to treasury
2. Treasury USDC is used to fund the Drips reward pool
3. Contributors claim points via the Drips Wave app

## For Contributors

1. Visit [drips.network/wave](https://drips.network/wave)
2. Connect your GitHub account
3. Find AnchorPay in the repo list
4. Browse open issues with `Stellar Wave` label
5. Apply to an issue — submit your PR when approved
6. Earn points on merge, redeemable for USDC grants

## Wave-ready issue backlog

See [GitHub Issues](../../issues) filtered by `Stellar Wave` label.

### Suggested first issues

**Trivial**
- Add loading skeletons to bill forms
- Write tests for VTPass service mock
- Improve error messages for failed transactions

**Medium**
- Implement data bundle form (same pattern as airtime)
- Add transaction history page (read from Stellar Horizon)
- PWA manifest + offline support
- Add NGN amount input that auto-converts to USDC

**High**
- Passkey/smart wallet support (no browser extension needed)
- Multi-bill cart — pay multiple bills in one transaction
- Push notifications for payment confirmation
- Admin dashboard for treasury management
