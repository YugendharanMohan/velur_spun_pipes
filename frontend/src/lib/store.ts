import { create } from 'zustand';
import { Item, Customer, Sale, CustomerOrder } from './mock-data';

interface ERPStore {
  items: Item[];
  customers: Customer[];
  sales: Sale[];
  customerOrders: CustomerOrder[];
  customerOrdersTotalPages: number;
  customerOrdersCurrentPage: number;
  isGlobalLoading: boolean;

  fetchInventory: () => Promise<void>;
  addItem: (item: Omit<Item, 'id'>) => Promise<void>;
  updateItem: (id: string, data: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  fetchCustomers: () => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id'>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  fetchSales: () => Promise<void>;
  fetchCustomerOrders: (email: string, page?: number, limit?: number) => Promise<void>;
  addSale: (sale: any) => Promise<void>;

  updateOrderStatus: (id: string, status: CustomerOrder['status'], items?: any[]) => Promise<void>;
}

export const useERPStore = create<ERPStore>((set, get) => ({
  items: [],
  customers: [],
  sales: [],
  customerOrders: [],
  customerOrdersTotalPages: 1,
  customerOrdersCurrentPage: 1,
  isGlobalLoading: false,

  fetchInventory: async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/items');
      const items = await res.json();
      set({ items });
    } catch (e) {
      console.error(e);
    }
  },

  addItem: async (item) => {
    const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/add_item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    const data = await res.json();
    if (!res.ok || (data.success === false)) throw new Error(data.error || "Failed to add item");
    await get().fetchInventory();
  },

  updateItem: async (id, data) => {
    const res = await fetch(`\${import.meta.env.VITE_API_BASE_URL || ''}/api/update_item/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const resData = await res.json();
    if (!res.ok || (resData.success === false)) throw new Error(resData.error || "Failed to update item");
    await get().fetchInventory();
  },

  deleteItem: async (id) => {
    const res = await fetch(`\${import.meta.env.VITE_API_BASE_URL || ''}/api/delete_item/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || (data.success === false)) throw new Error(data.error || "Failed to delete item");
    await get().fetchInventory();
  },

  fetchCustomers: async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/parties');
      const customers = await res.json();
      set({ customers });
    } catch (e) {
      console.error(e);
    }
  },

  addCustomer: async (customer) => {
    const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/add_party', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    const data = await res.json();
    if (!res.ok || (data.success === false)) throw new Error(data.error || "Failed to add customer");
    await get().fetchCustomers();
  },

  deleteCustomer: async (id) => {
    const res = await fetch(`\${import.meta.env.VITE_API_BASE_URL || ''}/api/parties/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || (data.success === false)) throw new Error(data.error || "Failed to delete customer");
    await get().fetchCustomers();
  },

  fetchSales: async () => {
    try {
      // In old app we had separate pagination, but new app wants all to reduce/filter 
      // For dashboard mapping, we fetch a large limit of sales.
      // E.g. limit=1000 to satisfy Dashboard metrics without crashing
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/sales?limit=1000');
      const data = await res.json();
      set({ sales: data.sales || [] });

      const activeRes = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/active_orders?limit=1000');
      const activeData = await activeRes.json();
      set({ customerOrders: activeData.active_orders || [] });
    } catch (e) {
      console.error(e);
    }
  },

  fetchCustomerOrders: async (email: string, page = 1, limit = 10) => {
    try {
      const res = await fetch(`\${import.meta.env.VITE_API_BASE_URL || ''}/api/customer_orders/${encodeURIComponent(email)}?page=${page}&limit=${limit}`);
      const data = await res.json();
      set({
        customerOrders: data.orders || [],
        customerOrdersTotalPages: data.total_pages || 1,
        customerOrdersCurrentPage: data.current_page || 1
      });
    } catch (e) {
      console.error(e);
    }
  },

  addSale: async (sale) => {
    const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/save_sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale)
    });
    const data = await res.json();
    if (!res.ok || (data.success === false)) throw new Error(data.error || "Failed to create sale");
    await get().fetchSales();
  },

  updateOrderStatus: async (id, status, items = []) => {
    const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/update_order_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: id, status, items })
    });
    const data = await res.json();
    if (!res.ok || (data.success === false)) throw new Error(data.error || "Failed to update order");
    await get().fetchSales();
  },
}));
