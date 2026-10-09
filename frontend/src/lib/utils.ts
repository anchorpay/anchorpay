import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNGN(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSDC(amount: number): string {
  return `${amount.toFixed(4)} USDC`;
}

export function generatePaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const NETWORKS = [
  { value: 'mtn',     label: 'MTN',     color: '#FFCC00' },
  { value: 'airtel',  label: 'Airtel',  color: '#FF0000' },
  { value: 'glo',     label: 'Glo',     color: '#008000' },
  { value: '9mobile', label: '9mobile', color: '#006633' },
] as const;

export const DISCOS = [
  { value: 'ikeja-electric',        label: 'Ikeja Electric (Lagos)' },
  { value: 'eko-electric',          label: 'Eko Electric (Lagos)' },
  { value: 'abuja-electric',        label: 'Abuja Electric (FCT)' },
  { value: 'kano-electric',         label: 'Kano Electric' },
  { value: 'port-harcourt-electric',label: 'PHED (Port Harcourt)' },
  { value: 'jos-electric',          label: 'Jos Electric' },
  { value: 'kaduna-electric',       label: 'Kaduna Electric' },
  { value: 'enugu-electric',        label: 'Enugu Electric' },
  { value: 'ibadan-electric',       label: 'Ibadan Electric' },
  { value: 'benin-electric',        label: 'Benin Electric' },
  { value: 'yola-electric',         label: 'Yola Electric' },
] as const;

export const CABLE_PROVIDERS = [
  { value: 'dstv',      label: 'DSTV' },
  { value: 'gotv',      label: 'GOtv' },
  { value: 'startimes', label: 'Startimes' },
] as const;
