# AnchorPay

**Pay your Nigerian bills with USDC on Stellar.**

Pay MTN airtime, Glo data, DSTV, GOtv, and electricity (all 11 DisCos) directly from your USDC wallet. No banks. No naira. No wahala.

[![Stellar Wave Program](https://img.shields.io/badge/Stellar%20Wave-Program-008751)](https://drips.network/wave)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## What It Does

Nigerians spend billions monthly on airtime, data, electricity and cable TV. Every existing platform requires a naira bank account. AnchorPay removes that dependency — connect a Stellar wallet, hold USDC, pay any Nigerian bill in seconds.

| Bill Type | Providers |
|-----------|-----------|
| Airtime | MTN, Airtel, Glo, 9mobile |
| Data | MTN, Airtel, Glo, 9mobile |
| Electricity | All 11 DisCos (Ikeja, Eko, Abuja, Kano, PHED, Jos, Kaduna, Enugu, Ibadan, Benin, Yola) |
| Cable TV | DSTV, GOtv, Startimes |

## How It Works

```
User (USDC wallet)
      │
      ▼
Soroban contract ── locks USDC in escrow
      │
      ▼
Backend API ── converts USDC → NGN via Daya off-ramp
      │
      ▼
VTPass API ── fulfils bill (airtime/electricity/cable)
      │
      ▼
Contract releases USDC to treasury ── bill delivered
```

If fulfilment fails, USDC is automatically refundable after ~30 minutes (300 ledgers).

## Stack

| Layer | Tech |
|-------|------|
| Smart contract | Rust / Soroban |
| Backend | Node.js, Express, TypeScript |
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Wallet | Freighter (Stellar) |
| Bill API | VTPass |
| Off-ramp | Daya (USDC → NGN) |
| Network | Stellar (testnet + mainnet) |

## Project Structure

```
AnchorPay/
├── contracts/
│   └── payment_processor/   # Soroban escrow contract (Rust)
├── backend/
│   └── src/
│       ├── services/
│       │   ├── vtpass.ts    # Bill fulfilment
│       │   ├── daya.ts      # USDC/NGN off-ramp
│       │   └── stellar.ts   # Contract interaction
│       ├── routes/
│       │   └── bills.ts     # Quote, fulfill, verify endpoints
│       └── index.ts         # Express server
└── frontend/
    └── src/
        ├── app/             # Next.js app router
        ├── components/      # AirtimeForm, ElectricityForm, CableForm
        └── lib/             # API client, wallet integration
```

## Getting Started

### Prerequisites

- Node.js 20+
- Rust + `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/cli)
- [Freighter wallet](https://freighter.app) browser extension

### 1. Clone & install

```bash
git clone https://github.com/chazed/AnchorPay.git
cd AnchorPay
npm run install:all
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill in your API keys:
- **VTPass**: Sign up at [vtpass.com](https://vtpass.com) — free sandbox available
- **Daya**: Sign up at [daya.co](https://daya.co) for USDC/NGN off-ramp
- **Stellar**: Generate a keypair with `stellar keys generate admin`

### 3. Deploy the Soroban contract

```bash
cd contracts

# Build
cargo build --target wasm32-unknown-unknown --release

# Optimize
stellar contract optimize \
  --wasm target/wasm32-unknown-unknown/release/payment_processor.wasm

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/payment_processor.optimized.wasm \
  --source admin \
  --network testnet

# Initialize (replace addresses)
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --usdc_token <USDC_TOKEN_ADDRESS> \
  --treasury <TREASURY_ADDRESS> \
  --fee_bps 50
```

Copy `CONTRACT_ID` into your `.env` files.

### 4. Run tests

```bash
# Soroban contract tests
cd contracts && cargo test

# Backend tests
cd backend && npm test
```

### 5. Start development

```bash
# From root
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues labelled `Stellar Wave` are funded through the [Drips Wave Program](https://drips.network/wave).

## License

MIT
