import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  stellar: {
    network: process.env.STELLAR_NETWORK ?? 'testnet',
    rpcUrl: process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    contractId: process.env.CONTRACT_ID ?? '',
    adminSecretKey: process.env.ADMIN_SECRET_KEY ?? '',
    treasuryAddress: process.env.TREASURY_ADDRESS ?? '',
    usdcTokenAddress: process.env.USDC_TOKEN_ADDRESS ?? '',
  },

  flutterwave: {
    secretKey: process.env.FLW_SECRET_KEY ?? '',
    publicKey: process.env.FLW_PUBLIC_KEY ?? '',
    baseUrl: process.env.FLW_BASE_URL ?? 'https://api.flutterwave.com/v3',
  },

  daya: {
    apiKey: process.env.DAYA_API_KEY ?? '',
    baseUrl: process.env.DAYA_BASE_URL ?? 'https://api.daya.co/v1',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
  },
};
