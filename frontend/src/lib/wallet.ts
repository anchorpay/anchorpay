/**
 * Stellar wallet integration — Freighter v6
 * Docs: https://docs.freighter.app
 */

import {
  isConnected,
  getPublicKey,
  signTransaction,
  requestAccess,
} from '@stellar/freighter-api';
import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  scValToNative,
} from '@stellar/stellar-sdk';

const SOROBAN_RPC =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  'https://soroban-testnet.stellar.org';
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';
const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';

const networkPassphrase =
  STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

const server = new SorobanRpc.Server(SOROBAN_RPC);

// ─── Wallet connection ────────────────────────────────────────────────────────

export async function checkFreighterInstalled(): Promise<boolean> {
  try {
    const result = await isConnected();
    return result.isConnected;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new Error(
      'Freighter wallet not installed. Visit https://freighter.app'
    );
  }
  // requestAccess prompts the user to grant access
  const accessResult = await requestAccess();
  if (accessResult.error) throw new Error(accessResult.error);

  const pubKeyResult = await getPublicKey();
  if (pubKeyResult.error) throw new Error(pubKeyResult.error);

  return pubKeyResult.address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const connected = await isConnected();
    if (!connected.isConnected) return null;
    const result = await getPublicKey();
    return result.error ? null : result.address;
  } catch {
    return null;
  }
}

// ─── USDC balance ─────────────────────────────────────────────────────────────

export async function getUsdcBalance(
  walletAddress: string,
  usdcTokenAddress: string
): Promise<number> {
  try {
    const contract = new Contract(usdcTokenAddress);
    const account = await server.getAccount(walletAddress);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call('balance', new Address(walletAddress).toScVal())
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) return 0;

    const raw = scValToNative(sim.result!.retval) as bigint;
    return Number(raw) / 10_000_000;
  } catch {
    return 0;
  }
}

// ─── Initiate payment ─────────────────────────────────────────────────────────

export interface InitiatePaymentParams {
  paymentId: string;
  walletAddress: string;
  usdcAmount: number;
  billType: string;
  billRef: string;
  billAmountNgn: number;
}

export async function initiatePayment(
  params: InitiatePaymentParams
): Promise<string> {
  const {
    paymentId,
    walletAddress,
    usdcAmount,
    billType,
    billRef,
    billAmountNgn,
  } = params;

  const usdcStroops = BigInt(Math.round(usdcAmount * 10_000_000));
  const ngnKobo = BigInt(Math.round(billAmountNgn * 100));

  const account = await server.getAccount(walletAddress);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        'initiate_payment',
        nativeToScVal(paymentId, { type: 'string' }),
        new Address(walletAddress).toScVal(),
        nativeToScVal(usdcStroops, { type: 'i128' }),
        nativeToScVal(billType, { type: 'string' }),
        nativeToScVal(billRef, { type: 'string' }),
        nativeToScVal(ngnKobo, { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  const xdrToSign = prepared.toXDR();

  // Sign with Freighter v6 — signTransaction takes xdr + options
  const signed = await signTransaction(xdrToSign, {
    networkPassphrase,
    address: walletAddress,
  });

  if (signed.error) throw new Error(signed.error);

  const { TransactionBuilder: TB } = await import('@stellar/stellar-sdk');
  const signedTx = TB.fromXDR(signed.signedTxXdr, networkPassphrase);
  const result = await server.sendTransaction(signedTx as any);

  if (result.status === 'ERROR') {
    throw new Error(
      `Transaction failed: ${JSON.stringify(result.errorResult)}`
    );
  }

  return result.hash;
}
