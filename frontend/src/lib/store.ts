import { create } from 'zustand';
import { Item, Customer, Sale } from './mock-data';

const API = () => import.meta.env.VITE_API_URL || '';

interface ERPStore {
  items: Item[];
  customers: Customer[];
  sales: Sale[];

  fetchInventory: () => Promise<void>;
  addItem: (item: Omit<Item, 'id'>) => Promise<void>;
  updateItem: (id: string, data: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  fetchCustomers: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<void>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  fetchSales: () => Promise<void>;
  addSale: (sale: any) => Promise<{ id: string }>;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(API() + url, opts);
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server error (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || data.success === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const useERPStore = create<ERPStore>((set, get) => ({
  items: [],
  customers: [],
  sales: [],

  fetchInventory: async () => {
    try {
      const items = await apiFetch('/api/items');
      set({ items });
    } catch (e) { console.error(e); }
  },

  addItem: async (item) => {
    await apiFetch('/api/add_item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    await get().fetchInventory();
  },

  updateItem: async (id, data) => {
    await apiFetch(`/api/update_item/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await get().fetchInventory();
  },

  deleteItem: async (id) => {
    await apiFetch(`/api/delete_item/${id}`, { method: 'DELETE' });
    await get().fetchInventory();
  },

  fetchCustomers: async () => {
    try {
      const customers = await apiFetch('/api/parties');
      set({ customers });
    } catch (e) { console.error(e); }
  },

  addCustomer: async (customer) => {
    await apiFetch('/api/add_party', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    await get().fetchCustomers();
  },

  updateCustomer: async (id, data) => {
    await apiFetch(`/api/parties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await get().fetchCustomers();
  },

  deleteCustomer: async (id) => {
    await apiFetch(`/api/parties/${id}`, { method: 'DELETE' });
    await get().fetchCustomers();
  },

  fetchSales: async () => {
    try {
      const data = await apiFetch('/api/sales?limit=1000');
      set({ sales: data.sales || [] });
    } catch (e) { console.error(e); }
  },

  addSale: async (sale) => {
    const data = await apiFetch('/api/save_sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale),
    });
    await get().fetchSales();
    return { id: data.id };
  },
}));
