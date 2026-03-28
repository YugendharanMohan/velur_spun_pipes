import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Pencil, Trash2, History, Users } from 'lucide-react';
import { useERPStore } from '@/lib/store';
import { formatMoney, formatDate } from '@/lib/mock-data';
import { toast } from 'sonner';
import type { Customer } from '@/lib/mock-data';

const EMPTY_FORM = {
  name: '', gst_number: '', customer_email: '', phone_number: '',
  billing_address: '', shipping_address: '', vehicle_number: '', eway_number: '',
};

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, fetchCustomers } = useERPStore();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone_number || '').includes(search) ||
    (c.gst_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({
      name: c.name, gst_number: c.gst_number || '', customer_email: c.customer_email || '',
      phone_number: c.phone_number || '', billing_address: c.billing_address || '',
      shipping_address: c.shipping_address || '', vehicle_number: c.vehicle_number || '',
      eway_number: c.eway_number || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    try {
      if (editId) {
        await updateCustomer(editId, form);
        toast.success('Customer updated');
      } else {
        await addCustomer(form);
        toast.success('Customer added');
      }
      setShowForm(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await deleteCustomer(id); toast.success('Customer deleted'); }
    catch (err: any) { toast.error(err.message); }
  };

  const openHistory = async (name: string) => {
    setShowHistory(name);
    setLoadingHistory(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/sales/party/${encodeURIComponent(name)}`);
      setHistory(await res.json());
    } catch { setHistory([]); }
    finally { setLoadingHistory(false); }
  };

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="text-xl font-bold">Customers</h2>
            <p className="text-sm text-muted-foreground">{customers.length} registered</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Button size="sm" onClick={openAdd} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Phone</TableHead>
                <TableHead className="text-xs hidden md:table-cell">GSTIN</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">Billing Address</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone_number || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{c.gst_number || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{c.billing_address || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary" onClick={() => openHistory(c.name)}>
                          <History className="h-3.5 w-3.5" /> History
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(c.id, c.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Customer Name *</Label>
                <Input placeholder="Full name" value={form.name} onChange={f('name')} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input placeholder="9876543210" value={form.phone_number} onChange={f('phone_number')} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input placeholder="email@example.com" value={form.customer_email} onChange={f('customer_email')} />
              </div>
              <div className="space-y-1.5">
                <Label>GSTIN</Label>
                <Input placeholder="33XXXXX..." value={form.gst_number} onChange={f('gst_number')} />
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle Number</Label>
                <Input placeholder="TN 00 XX 0000" value={form.vehicle_number} onChange={f('vehicle_number')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>E-Way Number</Label>
                <Input placeholder="E-way bill number" value={form.eway_number} onChange={f('eway_number')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Billing Address</Label>
                <Input placeholder="Door No, Street, City, State - PIN" value={form.billing_address} onChange={f('billing_address')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Shipping Address</Label>
                <Input placeholder="Same as billing or different" value={form.shipping_address} onChange={f('shipping_address')} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Add Customer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order History: {showHistory}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Invoice No</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingHistory ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No history found</TableCell></TableRow>
                ) : (
                  history.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatDate(s.created_at)}</TableCell>
                      <TableCell className="text-sm font-mono">{s.id.slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{s.doc_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold">{formatMoney(s.grand_total || 0)}</TableCell>
                      <TableCell className="text-sm">
                        <span className={s.balance_due > 0 ? 'text-destructive' : 'text-emerald-600'}>
                          {formatMoney(s.balance_due || 0)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
