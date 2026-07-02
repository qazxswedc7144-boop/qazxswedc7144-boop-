export interface PharmacyProfile {
  name: string;
  phone: string;
  address: string;
  taxNumber: string;
}

export interface FinancialSettings {
  currency: string;
  posBox: string;
  taxPercentage: number;
  maxDiscount: number;
}

export interface User {
  id: string;
  name: string;
  role: 'Administrator' | 'Pharmacist' | 'Cashier';
}

export interface UISettings {
  darkMode: boolean;
  printSize: '80mm' | 'A4';
}
