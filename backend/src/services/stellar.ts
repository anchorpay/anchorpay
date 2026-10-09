/**
 * Stellar service — interact with the Soroban payment processor contract
 */

import {
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  xdr,
} from '@stellar/stellar-sdk';
import { config } from '../config';

const server = new SorobanRpc.Server(config.stellar.rpcUrl);
const adminKeypair = config.stellar.adminSecretKey
  ? Keypair.fromSecret(config.stellar.adminSecretKey)
  : null;

const networkPassphrase =
  config.stellar.network === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

/**
 * Call release_payment on the Soroban contract after VTPass confirms fulfilment
 */
export async function releasePayment(paymentId: string): Promise<string> {
  if (!adminKeypair) throw new Error('Admin secret key not configured');
  if (!config.stellar.contractId) throw new Error('Contract ID not configured');

  const adminAccount = await server.getAccount(adminKeypair.publicKey());
  const contract = new Contract(config.stellar.contractId);

  const tx = new TransactionBuilder(adminAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        'release_payment',
        nativeToScVal(paymentId, { type: 'string' }),
        new Address(adminKeypair.publicKey()).toScVal()
      )
    )
    .setTimeout(30)
    .build();

  // Simulate first to get the correct fee
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(adminKeypair);

  const sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  // Poll for confirmation
  const hash = sendResult.hash;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await server.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain: ${hash}`);
    }
  }

  throw new Error(`Transaction not confirmed within timeout: ${hash}`);
}

/**
 * Get payment details from the contract
 */
export async function getPayment(paymentId: string) {
  if (!config.stellar.contractId) throw new Error('Contract ID not configured');

  const contract = new Contract(config.stellar.contractId);
  const adminAccount = await server.getAccount(
    adminKeypair?.publicKey() ?? config.stellar.treasuryAddress
  );

  const tx = new TransactionBuilder(adminAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      contract.call('get_payment', nativeToScVal(paymentId, { type: 'string' }))
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  return simResult.result?.retval;
}

/**
 * Listen for PaymentInitiated events from the contract
 * Used by the payment processor worker
 */
export async function getLatestPaymentEvents(startLedger: number) {
  if (!config.stellar.contractId) return [];

  const events = await server.getEvents({
    startLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [config.stellar.contractId],
        topics: [['AAAADQAAAAlpbml0aWF0ZWQ=']], // symbol_short!("initiated") in base64
      },
    ],
  });

  return events.events;
}
