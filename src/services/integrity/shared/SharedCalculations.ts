
export const SharedCalculations = {
  calculateTax: (amount: number, rate: number) => {
    return amount * (rate / 100);
  },
  derivePaymentStatus: (paid: number, total: number) => {
    if (paid <= 0) return 'Unpaid';
    if (paid >= total) return 'Paid';
    return 'Partially Paid';
  }
};
