'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle } from 'lucide-react';
import { quoteElectricity, verifyMeter } from '@/lib/api';
import { initiatePayment } from '@/lib/wallet';
import { cn, formatNGN, formatUSDC, generatePaymentId, DISCOS } from '@/lib/utils';
import type { Disco, MeterType } from '@/lib/api';

const schema = z.object({
  disco: z.string().min(1, 'Select your DisCo'),
  meterNumber: z.string().min(6, 'Enter valid meter number'),
  meterType: z.enum(['prepaid', 'postpaid']),
  amount: z.coerce.number().min(500, 'Min ₦500').max(500000, 'Max ₦500,000'),
});

type FormData = z.infer<typeof schema>;

interface Props {
  walletAddress: string | null;
  onSuccess: (txHash: string) => void;
}

export function ElectricityForm({ walletAddress, onSuccess }: Props) {
  const [meterInfo, setMeterInfo] = useState<{ name?: string; address?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
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

  const meterNumber = watch('meterNumber');
  const meterType = watch('meterType');
  const disco = watch('disco');

  async function handleVerifyMeter() {
    if (!meterNumber || meterNumber.length < 6 || !disco) return;
    setVerifying(true);
    setMeterInfo(null);
    try {
      const result = await verifyMeter(disco as Disco, meterNumber, meterType as MeterType);
      if (result?.content) {
        setMeterInfo({
          name: result.content.Customer_Name,
          address: result.content.Address,
        });
      }
    } catch {
      // silent — meter verification is best-effort
    } finally {
      setVerifying(false);
    }
  }

  async function onGetQuote(data: FormData) {
    setError(null);
    try {
      const result = await quoteElectricity(
        data.disco as Disco,
        data.meterNumber,
        data.meterType as MeterType,
        data.amount
      );
      setQuote(result);
      setStep('confirm');
    } catch {
      setError('Failed to get quote. Please try again.');
    }
  }

  async function onConfirm(data: FormData) {
    if (!walletAddress || !quote) return;
    setStep('processing');
    setError(null);
    try {
      const paymentId = generatePaymentId();
      const hash = await initiatePayment({
        paymentId,
        walletAddress,
        usdcAmount: quote.usdcRequired,
        billType: 'electricity',
        billRef: data.meterNumber,
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
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">⚡</div>
        <h3 className="text-lg font-semibold text-gray-800">Light don come!</h3>
        <p className="text-sm text-gray-500 text-center">
          Your electricity payment is confirmed. Token will be credited shortly.
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
          onClick={() => { setStep('form'); setQuote(null); setMeterInfo(null); }}
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
      {/* DisCo selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Distribution Company
        </label>
        <select
          {...register('disco')}
          className={cn(
            'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors bg-white',
            errors.disco ? 'border-red-400' : 'border-gray-200 focus:border-naira'
          )}
        >
          <option value="">Select your DisCo</option>
          {DISCOS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        {errors.disco && <p className="text-xs text-red-500 mt-1">{errors.disco.message}</p>}
      </div>

      {/* Meter type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Meter Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(['prepaid', 'postpaid'] as const).map((type) => (
            <label
              key={type}
              className={cn(
                'flex items-center justify-center py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium capitalize',
                watch('meterType') === type
                  ? 'border-naira bg-green-50 text-naira'
                  : 'border-gray-200 text-gray-600'
              )}
            >
              <input type="radio" value={type} {...register('meterType')} className="sr-only" />
              {type}
            </label>
          ))}
        </div>
      </div>

      {/* Meter number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Meter Number</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="45678901234"
            {...register('meterNumber')}
            onBlur={handleVerifyMeter}
            className={cn(
              'flex-1 px-4 py-3 rounded-xl border text-sm outline-none transition-colors',
              errors.meterNumber ? 'border-red-400' : 'border-gray-200 focus:border-naira'
            )}
          />
          {verifying && <Loader2 size={16} className="animate-spin self-center text-gray-400" />}
          {meterInfo && !verifying && (
            <CheckCircle size={20} className="self-center text-green-500" />
          )}
        </div>
        {meterInfo && (
          <p className="text-xs text-green-600 mt-1">
            {meterInfo.name} — {meterInfo.address}
          </p>
        )}
        {errors.meterNumber && (
          <p className="text-xs text-red-500 mt-1">{errors.meterNumber.message}</p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₦</span>
          <input
            type="number"
            placeholder="2000"
            {...register('amount')}
            className={cn(
              'w-full pl-8 pr-4 py-3 rounded-xl border text-sm outline-none transition-colors',
              errors.amount ? 'border-red-400' : 'border-gray-200 focus:border-naira'
            )}
          />
        </div>
        {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
        <div className="flex gap-2 mt-2">
          {[1000, 2000, 5000, 10000].map((a) => (
            <button
              key={a}
              type="button"
              className="flex-1 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium"
            >
              ₦{(a / 1000).toFixed(0)}k
            </button>
          ))}
        </div>
      </div>

      {/* Quote */}
      {quote && step === 'confirm' && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-600">You pay</span>
            <span className="font-semibold text-gray-800">{formatUSDC(quote.usdcRequired)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Units worth</span>
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
