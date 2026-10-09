'use client';

import { cn } from '@/lib/utils';
import { Phone, Wifi, Zap, Tv } from 'lucide-react';

export type BillTab = 'airtime' | 'data' | 'electricity' | 'cable';

const TABS: { id: BillTab; label: string; icon: React.ReactNode }[] = [
  { id: 'airtime',     label: 'Airtime',     icon: <Phone size={18} /> },
  { id: 'data',        label: 'Data',        icon: <Wifi size={18} /> },
  { id: 'electricity', label: 'Electricity', icon: <Zap size={18} /> },
  { id: 'cable',       label: 'Cable TV',    icon: <Tv size={18} /> },
];

interface Props {
  active: BillTab;
  onChange: (tab: BillTab) => void;
}

export function BillTabs({ active, onChange }: Props) {
  return (
    <div className="flex rounded-2xl bg-gray-100 p-1 gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all',
            active === tab.id
              ? 'bg-white text-naira shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {tab.icon}
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
