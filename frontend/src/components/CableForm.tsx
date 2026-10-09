'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { getDataPlans, verifySmartCard } from '@/lib/api';
import { initiatePayment } from '@/lib/wallet';
import { cn, formatNGN, formatUSDC, generatePaymentId, CABLE_PROVIDERS } from '@/lib/utils';
import { ngnToUsdc } from '@/lib/api';
import type { CableProvider } from '@/lib/api';

const schema = z.object({
  provider: z.enum(['dstv', 'gotv', 'startimes']),
  smartCardNumber: z.string().min(6, 'Enter valid smart card number'),
  planCode: z.string().min(1, 'Select a plan'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  walletAddress: string | null;
  onSuccess: (txHash: string) => void;
}

interface Plan {
  variation_code: string;
  name: string;
  variation_amount: string;
}

export function CableForm({ walletAddress, onSuccess }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [cardInfo, setCardInfo] = useState<{ name?: string } | null>(null);
  const [quote, setQuote] = useState<{ usdcRequired: number; ngnAmount: number } | null>(null);
  const [step, setStep] = useState<'form' | 'confirm' | 'processing' | 'done'>('form');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onChange' });

  const provider = watch('provider');
  const planCode = watch('planCode');
  const smartCardNumber = watch('smartCardNumber');

  // Load plans when provider changes
  useEffect(() => {
    if (!provider) return;
    setLoadingPlans(true);
    setPlans([]);
    // Cable plans come from VTPass service variations
    // Using the data plans endpoint as proxy — replace with cable-specific in production
    fetch(`/api/bills/plans/cable/${provider}`)
      .then((r) => r.json())
      .then((d) => setPlans(d?.content?.variations ?? []))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, [provider]);

  // Compute quote when plan selected
  useEffect(() => {
    const selected = plans.find((p) => p.variation_code === planCode);
    if (!selected) { setQuote(null); return; }
    const ngnAmount = parseFloat(selected.variation_amount);
    ngnToUsdc(ngnAmount).then((usdc) => setQuote({ usdcRequired: usdc, ngnAmount }));
  }, [planCode, plans]);

  async function handleVerifyCard() {
    if (!smartCardNumber || smartCardNumber.length < 6 || !provider) return;
    try {
      const result = await verifySmartCard(provider as CableProvider, smartCardNumber);
      if (result?.content) {
        setCardInfo({ name: result.content.Customer_Name });
      }
    } catch { /* silent */ }
  }

  async function onSubmit(data: FormData) {
    if (!walletAddress || !quote) return;
    setStep('processing');
    setError(null);
    try {
      const paymentId = generatePaymentId();
      const hash = await initiatePayment({
        paymentId,
        walletAddress,
        usdcAmount: quote.usdcRequired,
        billType: 'cable',
        billRef: data.smartCardNumber,
        billAmountNgn: quote.ngnAmount,
      });
      setTxHash(hash);
      setStep('done');
      onSuccess(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('form');
    }
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">📺</div>
        <h3 className="text-lg font-semibold text-gray-800">Subscription renewed!</h3>
        <p className="text-sm text-gray-500 text-center">
          Your cable subscription has been renewed successfully.
        </p>
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-naira underline break-all"
        >
          View transaction
        </a>
        <button
          onClick={() => { setStep('form'); setQuote(null); setCardInfo(null); }}
          className="mt-2 px-6 py-2 rounded-xl bg-naira text-white text-sm font-medium"
        >
          Pay Another Bill
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Provider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
        <div className="grid grid-cols-3 gap-2">
          {CABLE_PROVIDERS.map((p) => (
            <label
              key={p.value}
              className={cn(
                'flex items-center justify-center py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-semibold',
                provider === p.value
                  ? 'border-naira bg-green-50 text-naira'
                  : 'border-gray-200 text-gray-600'
              )}
            >
              <input type="radio" value={p.value} {...register('provider')} className="sr-only" />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {/* Smart card number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Smart Card Number</label>
        <input
          type="text"
          placeholder="1234567890"
          {...register('smartCardNumber')}
          onBlur={handleVerifyCard}
          className={cn(
            'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors',
            errors.smartCardNumber ? 'border-red-400' : 'border-gray-200 focus:border-naira'
          )}
        />
        {cardInfo && (
          <p className="text-xs text-green-600 mt-1">✓ {cardInfo.name}</p>
        )}
        {errors.smartCardNumber && (
          <p className="text-xs text-red-500 mt-1">{errors.smartCardNumber.message}</p>
        )}
      </div>

      {/* Plan selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Plan</label>
        {loadingPlans ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
            <Loader2 size={14} className="animate-spin" /> Loading plans...
          </div>
        ) : (
          <select
            {...register('planCode')}
            className={cn(
              'w-full px-4 py-3 rounded-xl border text-sm outline-none bg-white',
              errors.planCode ? 'border-red-400' : 'border-gray-200 focus:border-naira'
            )}
          >
            <option value="">Select a plan</option>
            {plans.map((plan) => (
              <option key={plan.variation_code} value={plan.variation_code}>
                {plan.name} — {formatNGN(parseFloat(plan.variation_amount))}
              </option>
            ))}
          </select>
        )}
        {errors.planCode && <p className="text-xs text-red-500 mt-1">{errors.planCode.message}</p>}
      </div>

      {/* Quote */}
      {quote && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">You pay</span>
            <span className="font-semibold text-gray-800">{formatUSDC(quote.usdcRequired)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Plan value</span>
            <span className="font-semibold text-naira">{formatNGN(quote.ngnAmount)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</p>}

      {!walletAddress && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-2">
          Connect your Freighter wallet to pay
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || step === 'processing' || !walletAddress || !quote}
        className={cn(
          'w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
          isValid && walletAddress && quote && step !== 'processing'
            ? 'bg-naira text-white hover:bg-brand-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        )}
      >
        {step === 'processing' && <Loader2 size={16} className="animate-spin" />}
        {step === 'processing' ? 'Processing...' : 'Confirm & Pay'}
      </button>
    </form>
  );
}
