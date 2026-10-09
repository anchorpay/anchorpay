'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { quoteAirtime } from '@/lib/api';
import { initiatePayment } from '@/lib/wallet';
import { cn, formatNGN, formatUSDC, generatePaymentId, NETWORKS } from '@/lib/utils';
import type { Network } from '@/lib/api';

const schema = z.object({
  network: z.enum(['mtn', 'airtel', 'glo', '9mobile']),
  phone: z
    .string()
    .regex(/^(0|\+234)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number'),
  amount: z.coerce.number().min(50, 'Min ₦50').max(50000, 'Max ₦50,000'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  walletAddress: string | null;
  onSuccess: (txHash: string) => void;
}

export function AirtimeForm({ walletAddress, onSuccess }: Props) {
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

  const selectedNetwork = watch('network');
  const amount = watch('amount');

  async function onGetQuote(data: FormData) {
    setError(null);
    try {
      const result = await quoteAirtime(data.network as Network, data.amount);
      setQuote(result);
      setStep('confirm');
    } catch {
      setError('Failed to get quote. Please try again.');
    }
  }

  async function onConfirm(data: FormData) {
    if (!walletAddress) {
      setError('Connect your wallet first');
      return;
    }
    if (!quote) return;
    setStep('processing');
    setError(null);
    try {
      const paymentId = generatePaymentId();
      const hash = await initiatePayment({
        paymentId,
        walletAddress,
        usdcAmount: quote.usdcRequired,
        billType: 'airtime',
        billRef: data.phone,
        billAmountNgn: data.amount,
      });
      setTxHash(hash);
      setStep('done');
      onSuccess(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('confirm');
    }
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">
          ✅
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Airtime on the way!</h3>
        <p className="text-sm text-gray-500 text-center">
          Your payment is confirmed. Airtime will be credited in seconds.
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
          onClick={() => { setStep('form'); setQuote(null); }}
          className="mt-2 px-6 py-2 rounded-xl bg-naira text-white text-sm font-medium"
        >
          Pay Another Bill
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(step === 'form' ? onGetQuote : onConfirm)}
      className="flex flex-col gap-4"
    >
      {/* Network selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Network</label>
        <div className="grid grid-cols-4 gap-2">
          {NETWORKS.map((n) => (
            <label
              key={n.value}
              className={cn(
                'flex items-center justify-center py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-semibold',
                selectedNetwork === n.value
                  ? 'border-naira bg-green-50 text-naira'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              <input
                type="radio"
                value={n.value}
                {...register('network')}
                className="sr-only"
              />
              {n.label}
            </label>
          ))}
        </div>
        {errors.network && (
          <p className="text-xs text-red-500 mt-1">{errors.network.message}</p>
        )}
      </div>

      {/* Phone number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number
        </label>
        <input
          type="tel"
          placeholder="0801 234 5678"
          {...register('phone')}
          className={cn(
            'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors',
            errors.phone
              ? 'border-red-400 focus:border-red-400'
              : 'border-gray-200 focus:border-naira'
          )}
        />
        {errors.phone && (
          <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Amount (₦)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            ₦
          </span>
          <input
            type="number"
            placeholder="500"
            {...register('amount')}
            className={cn(
              'w-full pl-8 pr-4 py-3 rounded-xl border text-sm outline-none transition-colors',
              errors.amount
                ? 'border-red-400 focus:border-red-400'
                : 'border-gray-200 focus:border-naira'
            )}
          />
        </div>
        {errors.amount && (
          <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>
        )}
        {/* Quick amount buttons */}
        <div className="flex gap-2 mt-2">
          {[100, 200, 500, 1000].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('input[type="number"]');
                if (input) { input.value = String(a); input.dispatchEvent(new Event('input', { bubbles: true })); }
              }}
              className="flex-1 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors"
            >
              ₦{a}
            </button>
          ))}
        </div>
      </div>

      {/* Quote display */}
      {quote && step === 'confirm' && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">You pay</span>
            <span className="font-semibold text-gray-800">
              {formatUSDC(quote.usdcRequired)}
            </span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">Airtime value</span>
            <span className="font-semibold text-naira">{formatNGN(quote.ngnAmount)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Rate locked for 2 minutes. Escrow released on delivery.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</p>
      )}

      {/* CTA */}
      {!walletAddress && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-2">
          Connect your Freighter wallet to pay
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || step === 'processing' || !walletAddress}
        className={cn(
          'w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
          isValid && walletAddress && step !== 'processing'
            ? 'bg-naira text-white hover:bg-brand-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        )}
      >
        {step === 'processing' && <Loader2 size={16} className="animate-spin" />}
        {step === 'form' && 'Get Quote'}
        {step === 'confirm' && 'Confirm & Pay'}
        {step === 'processing' && 'Processing...'}
      </button>
    </form>
  );
}
