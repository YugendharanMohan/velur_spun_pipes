export interface Item {
  id: string;
  name: string;
  price: number;
  gst: number;
  stock: number;
}

export interface Customer {
  id: string;
  name: string;
  gst_number: string;
  customer_email: string;
  phone_number: string;
  billing_address: string;
  shipping_address: string;
  vehicle_number: string;
  eway_number: string;
  created_at?: string;
}

export interface SaleItem {
  name: string;
  hsn: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

export interface Sale {
  id: string;
  party_name: string;
  billing_address: string;
  shipping_address: string;
  vehicle_number: string;
  eway_number: string;
  gst_number: string;
  items: SaleItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  grand_total: number;
  advance_payment: number;
  balance_due: number;
  notes: string;
  doc_type: 'Tax Invoice' | 'Estimation';
  status: 'Completed';
  created_at: string;
}

export const formatMoney = (amount: number): string =>
  '₹ ' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const getStockStatus = (stock: number) => {
  if (stock === 0) return { label: 'Out of Stock', variant: 'destructive' as const };
  if (stock < 20) return { label: 'Low Stock', variant: 'warning' as const };
  return { label: 'In Stock', variant: 'success' as const };
};
