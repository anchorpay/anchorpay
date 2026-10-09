'use client';

import { useState, useEffect, useCallback } from 'react';
import { BillTabs, type BillTab } from '@/components/BillTabs';
import { WalletButton } from '@/components/WalletButton';
import { AirtimeForm } from '@/components/AirtimeForm';
import { ElectricityForm } from '@/components/ElectricityForm';
import { CableForm } from '@/components/CableForm';
import { getWalletAddress, getUsdcBalance } from '@/lib/wallet';
import { getRate } from '@/lib/api';
import { Zap } from 'lucide-react';

const USDC_TOKEN =
  process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ??
  'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'; // testnet USDC

export default function Home() {
  const [activeTab, setActiveTab] = useState<BillTab>('airtime');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [rate, setRate] = useState<number | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // Restore wallet on mount
  useEffect(() => {
    getWalletAddress().then((addr) => {
      if (addr) setWalletAddress(addr);
    });
    getRate()
      .then((r) => setRate(r.usdc_to_ngn))
      .catch(() => null);
  }, []);

  // Refresh balance when wallet changes
  useEffect(() => {
    if (!walletAddress) { setUsdcBalance(0); return; }
    getUsdcBalance(walletAddress, USDC_TOKEN).then(setUsdcBalance);
  }, [walletAddress]);

  const handleConnect = useCallback((address: string) => {
    setWalletAddress(address);
  }, []);

  const handleDisconnect = useCallback(() => {
    setWalletAddress(null);
    setUsdcBalance(0);
  }, []);

  const handleSuccess = useCallback((txHash: string) => {
    setLastTx(txHash);
    // Refresh balance after payment
    if (walletAddress) {
      setTimeout(() => {
        getUsdcBalance(walletAddress, USDC_TOKEN).then(setUsdcBalance);
      }, 5000);
    }
  }, [walletAddress]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-naira flex items-center justify-center">
              <Zap size={16} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-lg text-gray-900">AnchorPay</span>
          </div>
          <WalletButton
            address={walletAddress}
            usdcBalance={usdcBalance}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </header>

      {/* Rate ticker */}
      {rate && (
        <div className="bg-naira/5 border-b border-naira/10 px-4 py-1.5">
          <p className="text-xs text-center text-naira font-medium">
            1 USDC ≈ ₦{rate.toLocaleString()} · Powered by Stellar
          </p>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-md mx-auto">
          {/* Hero text */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Sort your bills
            </h1>
            <p className="text-sm text-gray-500">
              Pay with USDC on Stellar — faster, cheaper, no bank wahala
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <BillTabs active={activeTab} onChange={setActiveTab} />
            <div className="mt-5">
              {activeTab === 'airtime' && (
                <AirtimeForm walletAddress={walletAddress} onSuccess={handleSuccess} />
              )}
              {activeTab === 'data' && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Data plans coming soon — try Airtime or Electricity
                </div>
              )}
              {activeTab === 'electricity' && (
                <ElectricityForm walletAddress={walletAddress} onSuccess={handleSuccess} />
              )}
              {activeTab === 'cable' && (
                <CableForm walletAddress={walletAddress} onSuccess={handleSuccess} />
              )}
            </div>
          </div>

          {/* Recent success */}
          {lastTx && (
            <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-green-700 font-medium">Last payment confirmed ✓</span>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${lastTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-naira underline"
              >
                View
              </a>
            </div>
          )}

          {/* No wallet CTA */}
          {!walletAddress && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-center">
              <p className="text-sm text-amber-700 mb-1 font-medium">New to Stellar?</p>
              <p className="text-xs text-amber-600">
                Install{' '}
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Freighter wallet
                </a>{' '}
                to get started. It&apos;s free.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400">
        AnchorPay · Built on{' '}
        <a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className="underline">
          Stellar
        </a>{' '}
        · Open source on{' '}
        <a
          href="https://github.com/chazed/AnchorPay"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
