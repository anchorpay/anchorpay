'use client';

import { useState } from 'react';
import { Wallet, LogOut, Copy, Check } from 'lucide-react';
import { connectWallet } from '@/lib/wallet';
import { cn } from '@/lib/utils';

interface Props {
  address: string | null;
  usdcBalance: number;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

export function WalletButton({ address, usdcBalance, onConnect, onDisconnect }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const addr = await connectWallet();
      onConnect(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  if (!address) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={handleConnect}
          disabled={loading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all',
            'bg-naira text-white hover:bg-brand-700 disabled:opacity-60'
          )}
        >
          <Wallet size={16} />
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {error && (
          <p className="text-xs text-red-500 max-w-[220px] text-right">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex flex-col items-end">
        <span className="text-xs text-gray-500">USDC Balance</span>
        <span className="text-sm font-semibold text-gray-800">
          {usdcBalance.toFixed(4)} USDC
        </span>
      </div>
      <button
        onClick={copyAddress}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-mono transition-colors"
      >
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        {shortAddress}
      </button>
      <button
        onClick={onDisconnect}
        className="p-2 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-600 transition-colors"
        aria-label="Disconnect wallet"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
