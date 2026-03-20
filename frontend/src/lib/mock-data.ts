// Mock data store for the ERP system

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
  phone: string;
  address: string;
}

export interface SaleItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface Sale {
  id: string;
  party_name: string;
  items: SaleItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  doc_type: "Tax Invoice" | "Estimation";
  status: "Pending" | "Approved" | "Ready" | "Completed" | "Rejected";
  created_at: string;
}

export interface CustomerOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  items: SaleItem[];
  total: number;
  status: "Pending" | "Approved" | "Ready" | "Completed" | "Rejected";
  doc_type: string;
  created_at: string;
}




// Utility functions
export const formatMoney = (amount: number): string => {
  return "₹ " + amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const getStockStatus = (stock: number): { label: string; variant: "success" | "warning" | "destructive" } => {
  if (stock === 0) return { label: "Out of Stock", variant: "destructive" };
  if (stock < 20) return { label: "Low Stock", variant: "warning" };
  return { label: "In Stock", variant: "success" };
};
