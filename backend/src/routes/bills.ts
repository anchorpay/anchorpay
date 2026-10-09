/**
 * Bills router — quote, initiate, status
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { fulfillBill, getDataPlans, verifyMeter, verifySmartCard } from '../services/flutterwave';
import { ngnToUsdc, usdcToNgn } from '../services/daya';
import { releasePayment } from '../services/stellar';

export const billsRouter = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const QuoteSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('airtime'),
    network: z.enum(['mtn', 'airtel', 'glo', '9mobile']),
    amount: z.number().min(50).max(50000), // NGN
  }),
  z.object({
    type: z.literal('data'),
    network: z.enum(['mtn', 'airtel', 'glo', '9mobile']),
    planCode: z.string().min(1),
  }),
  z.object({
    type: z.literal('electricity'),
    disco: z.string().min(1),
    meterNumber: z.string().min(6),
    meterType: z.enum(['prepaid', 'postpaid']),
    amount: z.number().min(500).max(500000), // NGN
  }),
  z.object({
    type: z.literal('cable'),
    provider: z.enum(['dstv', 'gotv', 'startimes']),
    smartCardNumber: z.string().min(6),
    planCode: z.string().min(1),
  }),
]);

const FulfillSchema = z.object({
  paymentId: z.string().uuid(),
  bill: QuoteSchema,
});

// ─── GET /bills/quote ─────────────────────────────────────────────────────────

billsRouter.post('/quote', async (req: Request, res: Response) => {
  const parsed = QuoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    let ngnAmount = 0;
    const bill = parsed.data;

    if (bill.type === 'airtime') {
      ngnAmount = bill.amount;
    } else if (bill.type === 'electricity') {
      ngnAmount = bill.amount;
    } else {
      // data/cable — fixed plan price, need to look up from VTPass
      // For now return a placeholder; real implementation fetches plan price
      ngnAmount = 0;
    }

    const usdcRequired = ngnAmount > 0 ? await ngnToUsdc(ngnAmount) : null;

    return res.json({
      ngnAmount,
      usdcRequired,
      note:
        usdcRequired
          ? `You need ${usdcRequired.toFixed(4)} USDC to pay ₦${ngnAmount.toLocaleString()}`
          : 'Select a plan to get a quote',
    });
  } catch (err) {
    console.error('Quote error:', err);
    return res.status(500).json({ error: 'Failed to get quote' });
  }
});

// ─── POST /bills/fulfill ──────────────────────────────────────────────────────
// Called by the payment worker after on-chain payment is confirmed

billsRouter.post('/fulfill', async (req: Request, res: Response) => {
  const parsed = FulfillSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { paymentId, bill } = parsed.data;

  try {
    // 1. Fulfill via Flutterwave
    const flwResult = await fulfillBill(bill as any);

    if (flwResult.status !== 'success') {
      return res.status(502).json({
        error: 'Bill fulfilment failed',
        details: flwResult.message,
        // Do NOT release payment — will be refunded at expiry
      });
    }

    // 2. Release USDC from Soroban escrow to treasury
    const txHash = await releasePayment(paymentId);

    return res.json({
      success: true,
      paymentId,
      flwRef: flwResult.data.flw_ref,
      stellarTxHash: txHash,
      message: 'Bill paid successfully',
    });
  } catch (err) {
    console.error('Fulfill error:', err);
    return res.status(500).json({ error: 'Fulfillment failed' });
  }
});

// ─── GET /bills/plans/data/:network ──────────────────────────────────────────

billsRouter.get('/plans/data/:network', async (req: Request, res: Response) => {
  const network = req.params.network as 'mtn' | 'airtel' | 'glo' | '9mobile';
  if (!['mtn', 'airtel', 'glo', '9mobile'].includes(network)) {
    return res.status(400).json({ error: 'Invalid network' });
  }

  try {
    const plans = await getDataPlans(network);
    return res.json(plans);
  } catch (err) {
    console.error('Plans error:', err);
    return res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// ─── POST /bills/verify/meter ─────────────────────────────────────────────────

billsRouter.post('/verify/meter', async (req: Request, res: Response) => {
  const schema = z.object({
    disco: z.string().min(1),
    meterNumber: z.string().min(6),
    meterType: z.enum(['prepaid', 'postpaid']),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await verifyMeter(
      parsed.data.disco,
      parsed.data.meterNumber,
      parsed.data.meterType
    );
    return res.json(result);
  } catch (err) {
    console.error('Meter verify error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── POST /bills/verify/smartcard ────────────────────────────────────────────

billsRouter.post('/verify/smartcard', async (req: Request, res: Response) => {
  const schema = z.object({
    provider: z.enum(['dstv', 'gotv', 'startimes']),
    smartCardNumber: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await verifySmartCard(
      parsed.data.provider,
      parsed.data.smartCardNumber
    );
    return res.json(result);
  } catch (err) {
    console.error('Smartcard verify error:', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── GET /bills/rate ──────────────────────────────────────────────────────────

billsRouter.get('/rate', async (_req: Request, res: Response) => {
  try {
    const { getRate } = await import('../services/daya');
    const rate = await getRate();
    return res.json(rate);
  } catch (err) {
    console.error('Rate error:', err);
    return res.status(500).json({ error: 'Failed to fetch rate' });
  }
});
