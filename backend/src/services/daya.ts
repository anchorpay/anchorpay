/**
 * Daya service — USDC to NGN off-ramp
 * Docs: https://docs.daya.co
 *
 * Used to convert USDC from treasury wallet into NGN
 * to fund the VTPass wallet for bill fulfilment.
 */

import axios from 'axios';
import { config } from '../config';

const client = axios.create({
  baseURL: config.daya.baseUrl,
  headers: {
    Authorization: `Bearer ${config.daya.apiKey}`,
    'Content-Type': 'application/json',
  },
});

export interface ExchangeRate {
  usdc_to_ngn: number;      // e.g. 1580.5
  ngn_to_usdc: number;      // e.g. 0.000632
  updated_at: string;
}

export interface OfframpOrder {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  usdc_amount: number;
  ngn_amount: number;
  fee_usdc: number;
  stellar_deposit_address: string;
  memo: string;
  expires_at: string;
  created_at: string;
}

/**
 * Get current USDC/NGN exchange rate
 */
export async function getRate(): Promise<ExchangeRate> {
  const response = await client.get('/rates/USDC/NGN');
  return response.data;
}

/**
 * Calculate NGN amount for a given USDC amount
 * Uses live rate with a small buffer for slippage
 */
export async function usdcToNgn(usdcAmount: number): Promise<number> {
  const rate = await getRate();
  return Math.floor(usdcAmount * rate.usdc_to_ngn);
}

/**
 * Calculate USDC needed for a given NGN amount
 */
export async function ngnToUsdc(ngnAmount: number): Promise<number> {
  const rate = await getRate();
  // Add 1% buffer for rate fluctuation
  const raw = ngnAmount / rate.usdc_to_ngn;
  return parseFloat((raw * 1.01).toFixed(7));
}

/**
 * Create an off-ramp order — converts USDC → NGN
 * Treasury sends USDC to the returned deposit address
 */
export async function createOfframp(usdcAmount: number): Promise<OfframpOrder> {
  const response = await client.post('/offramp/orders', {
    from_currency: 'USDC',
    from_network: 'stellar',
    to_currency: 'NGN',
    amount: usdcAmount,
  });
  return response.data;
}

/**
 * Check status of an off-ramp order
 */
export async function getOfframpOrder(orderId: string): Promise<OfframpOrder> {
  const response = await client.get(`/offramp/orders/${orderId}`);
  return response.data;
}

/**
 * Get NGN balance available for bill fulfilment
 */
export async function getNgnBalance(): Promise<number> {
  const response = await client.get('/wallets/NGN/balance');
  return response.data.balance;
}
