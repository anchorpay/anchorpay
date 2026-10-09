/**
 * Flutterwave Bills service — Nigerian bill fulfilment
 * Docs: https://developer.flutterwave.com/docs/bill-payment
 *
 * Supports: airtime, data, electricity (all 11 DisCos), cable TV (DSTV/GOtv/Startimes)
 */

import axios from 'axios';
import { config } from '../config';

export type BillType = 'airtime' | 'data' | 'electricity' | 'cable';

export interface AirtimePayload {
  type: 'airtime';
  network: 'mtn' | 'airtel' | 'glo' | '9mobile';
  phone: string;
  amount: number; // NGN
}

export interface DataPayload {
  type: 'data';
  network: 'mtn' | 'airtel' | 'glo' | '9mobile';
  phone: string;
  planCode: string;
}

export interface ElectricityPayload {
  type: 'electricity';
  disco: string;
  meterNumber: string;
  meterType: 'prepaid' | 'postpaid';
  amount: number; // NGN
}

export interface CablePayload {
  type: 'cable';
  provider: 'dstv' | 'gotv' | 'startimes';
  smartCardNumber: string;
  planCode: string;
}

export type BillPayload =
  | AirtimePayload
  | DataPayload
  | ElectricityPayload
  | CablePayload;

export interface FlutterwaveResponse {
  status: string;
  message: string;
  data: {
    phone_number?: string;
    amount: number;
    network?: string;
    flw_ref: string;
    tx_ref: string;
    reference?: string;
  };
}

// Flutterwave biller item codes
// https://developer.flutterwave.com/docs/bill-payment#get-bill-categories
const BILLER_CODES: Record<string, string> = {
  // Airtime
  'airtime:mtn':     'BIL099',
  'airtime:airtel':  'BIL102',
  'airtime:glo':     'BIL103',
  'airtime:9mobile': 'BIL104',
  // Data
  'data:mtn':        'BIL106',
  'data:airtel':     'BIL107',
  'data:glo':        'BIL108',
  'data:9mobile':    'BIL109',
  // Electricity
  'electricity:ikeja-electric':         'BIL119',
  'electricity:eko-electric':           'BIL120',
  'electricity:abuja-electric':         'BIL121',
  'electricity:kano-electric':          'BIL122',
  'electricity:port-harcourt-electric': 'BIL123',
  'electricity:jos-electric':           'BIL124',
  'electricity:kaduna-electric':        'BIL125',
  'electricity:enugu-electric':         'BIL126',
  'electricity:ibadan-electric':        'BIL127',
  'electricity:benin-electric':         'BIL128',
  'electricity:yola-electric':          'BIL129',
  // Cable
  'cable:dstv':      'BIL110',
  'cable:gotv':      'BIL111',
  'cable:startimes': 'BIL112',
};

const client = axios.create({
  baseURL: config.flutterwave.baseUrl,
  headers: {
    Authorization: `Bearer ${config.flutterwave.secretKey}`,
    'Content-Type': 'application/json',
  },
});

function generateRef(): string {
  return `ANCHORPAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function fulfillBill(payload: BillPayload): Promise<FlutterwaveResponse> {
  const ref = generateRef();

  switch (payload.type) {
    case 'airtime': {
      const billerCode = BILLER_CODES[`airtime:${payload.network}`];
      const { data } = await client.post('/bills', {
        country: 'NG',
        customer: payload.phone,
        amount: payload.amount,
        recurrence: 'ONCE',
        type: 'AIRTIME',
        reference: ref,
        biller_name: billerCode,
      });
      return data;
    }

    case 'data': {
      const billerCode = BILLER_CODES[`data:${payload.network}`];
      const { data } = await client.post('/bills', {
        country: 'NG',
        customer: payload.phone,
        amount: 0, // amount determined by plan
        recurrence: 'ONCE',
        type: 'DATA_BUNDLE',
        reference: ref,
        biller_name: billerCode,
        code: payload.planCode,
      });
      return data;
    }

    case 'electricity': {
      const billerCode = BILLER_CODES[`electricity:${payload.disco}`];
      const { data } = await client.post('/bills', {
        country: 'NG',
        customer: payload.meterNumber,
        amount: payload.amount,
        recurrence: 'ONCE',
        type: 'POWER',
        reference: ref,
        biller_name: billerCode,
        code: payload.meterType === 'prepaid' ? 'prepaid' : 'postpaid',
      });
      return data;
    }

    case 'cable': {
      const billerCode = BILLER_CODES[`cable:${payload.provider}`];
      const { data } = await client.post('/bills', {
        country: 'NG',
        customer: payload.smartCardNumber,
        amount: 0, // amount determined by plan
        recurrence: 'ONCE',
        type: 'DSTV',
        reference: ref,
        biller_name: billerCode,
        code: payload.planCode,
      });
      return data;
    }
  }
}

export async function verifyMeter(
  disco: string,
  meterNumber: string,
  meterType: 'prepaid' | 'postpaid'
) {
  const billerCode = BILLER_CODES[`electricity:${disco}`];
  const { data } = await client.get(
    `/bill-items/${billerCode}/validate?code=${meterType}&customer=${meterNumber}`
  );
  return data;
}

export async function verifySmartCard(provider: string, smartCardNumber: string) {
  const billerCode = BILLER_CODES[`cable:${provider}`];
  const { data } = await client.get(
    `/bill-items/${billerCode}/validate?code=smartcard&customer=${smartCardNumber}`
  );
  return data;
}

export async function getDataPlans(network: 'mtn' | 'airtel' | 'glo' | '9mobile') {
  const billerCode = BILLER_CODES[`data:${network}`];
  const { data } = await client.get(`/bill-items/${billerCode}/validate`);
  return data;
}

export async function getBillStatus(reference: string) {
  const { data } = await client.get(`/bills/${reference}`);
  return data;
}
