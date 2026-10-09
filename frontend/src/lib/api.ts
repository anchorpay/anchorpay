import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type Network = 'mtn' | 'airtel' | 'glo' | '9mobile';
export type Disco =
  | 'ikeja-electric' | 'eko-electric' | 'abuja-electric'
  | 'kano-electric' | 'port-harcourt-electric' | 'jos-electric'
  | 'kaduna-electric' | 'enugu-electric' | 'ibadan-electric'
  | 'benin-electric' | 'yola-electric';
export type CableProvider = 'dstv' | 'gotv' | 'startimes';
export type MeterType = 'prepaid' | 'postpaid';

export interface QuoteResult {
  ngnAmount: number;
  usdcRequired: number;
  note: string;
}

export interface ExchangeRate {
  usdc_to_ngn: number;
  ngn_to_usdc: number;
  updated_at: string;
}

export interface DataPlan {
  variation_code: string;
  name: string;
  variation_amount: string;
  fixedPrice: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getRate(): Promise<ExchangeRate> {
  const { data } = await api.get<ExchangeRate>('/api/bills/rate');
  return data;
}

export async function quoteAirtime(network: Network, amount: number): Promise<QuoteResult> {
  const { data } = await api.post<QuoteResult>('/api/bills/quote', {
    type: 'airtime', network, amount,
  });
  return data;
}

export async function quoteElectricity(
  disco: Disco,
  meterNumber: string,
  meterType: MeterType,
  amount: number
): Promise<QuoteResult> {
  const { data } = await api.post<QuoteResult>('/api/bills/quote', {
    type: 'electricity', disco, meterNumber, meterType, amount,
  });
  return data;
}

export async function getDataPlans(network: Network): Promise<DataPlan[]> {
  const { data } = await api.get(`/api/bills/plans/data/${network}`);
  return data?.content?.variations ?? [];
}

export async function verifyMeter(
  disco: Disco,
  meterNumber: string,
  meterType: MeterType
) {
  const { data } = await api.post('/api/bills/verify/meter', {
    disco, meterNumber, meterType,
  });
  return data;
}

export async function verifySmartCard(
  provider: CableProvider,
  smartCardNumber: string
) {
  const { data } = await api.post('/api/bills/verify/smartcard', {
    provider, smartCardNumber,
  });
  return data;
}
