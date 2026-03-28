import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GripVertical, Plus, Trash2, Save, Receipt, ChevronDown, X } from 'lucide-react';
import { useERPStore } from '@/lib/store';
import { formatMoney } from '@/lib/mock-data';
import { sortProductsByDiameter } from '@/lib/utils';
import { toast } from 'sonner';

const HSN = '68109990';
const UNITS = ['Nos', 'Mtr', 'Kg', 'Ton', 'Set', 'NONE'];
const TAX_RATES = [0, 5, 12, 18, 28];

// ── Searchable customer combobox ──────────────────────────────────────────────
function CustomerCombobox({
  customers,
  value,
  onChange,
}: {
  customers: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return [...customers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, query]);

  const handleSelect = (id: string) => {
    onChange(id);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex items-center h-10 w-full rounded-md border border-input bg-background px-3 text-sm cursor-text transition-colors ${open ? 'ring-1 ring-ring border-ring' : 'hover:border-muted-foreground/50'}`}
        onClick={() => { setOpen(true); }}
      >
        {open ? (
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
            placeholder="Type to search customer..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : (
          <span className={`flex-1 truncate ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
            {selected ? selected.name : '-- Choose a Customer --'}
          </span>
        )}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {selected && !open && (
            <button onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">No customers found</div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                onMouseDown={() => handleSelect(c.id)}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${value === c.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
              >
                {c.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface BillRow {
  itemId: string;
  name: string;
  hsn: string;
  description: string;
  qty: number;
  unit: string;
  price: number;          // price without tax
  discountPct: number;
  discountAmt: number;
  taxPct: number;
  taxAmt: number;
  amount: number;         // final line amount (after discount + tax)
}

function calcRow(r: BillRow): BillRow {
  const base = r.qty * r.price;
  const discAmt = parseFloat(((base * r.discountPct) / 100).toFixed(2));
  const taxable = base - discAmt;
  const taxAmt = parseFloat(((taxable * r.taxPct) / 100).toFixed(2));
  return { ...r, discountAmt: discAmt, taxAmt, amount: taxable + taxAmt };
}

const emptyRow = (): BillRow =>
  calcRow({ itemId: '', name: '', hsn: HSN, description: '', qty: 1, unit: 'Nos', price: 0, discountPct: 0, discountAmt: 0, taxPct: 18, taxAmt: 0, amount: 0 });

export default function Sales() {
  const { items, customers, addSale } = useERPStore();
  const [docType, setDocType] = useState<'Tax Invoice' | 'Estimation'>('Tax Invoice');

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [ewayNumber, setEwayNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  const [rows, setRows] = useState<BillRow[]>([emptyRow()]);
  const [notes, setNotes] = useState('');
  const [advance, setAdvance] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedCustomerId) return;
    const c = customers.find((x) => x.id === selectedCustomerId);
    if (!c) return;
    setBillingAddress(c.billing_address || '');
    setShippingAddress(c.shipping_address || '');
    setVehicleNumber(c.vehicle_number || '');
    setEwayNumber(c.eway_number || '');
    setGstNumber(c.gst_number || '');
  }, [selectedCustomerId, customers]);

  const sortedItems = sortProductsByDiameter(items);

  const updateRow = (idx: number, patch: Partial<BillRow>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? calcRow({ ...r, ...patch }) : r))
    );
  };

  const selectItem = (idx: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? calcRow({ ...r, itemId, name: item.name, price: item.price, hsn: HSN }) : r
      )
    );
  };

  // When discount % changes, recalc discount amount (and vice versa)
  const updateDiscountPct = (idx: number, pct: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? calcRow({ ...r, discountPct: pct }) : r))
    );
  };

  const updateDiscountAmt = (idx: number, amt: number) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const base = r.qty * r.price;
        const pct = base > 0 ? parseFloat(((amt / base) * 100).toFixed(2)) : 0;
        return calcRow({ ...r, discountPct: pct, discountAmt: amt });
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx: number) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Totals
  const totalQty = useMemo(() => rows.reduce((s, r) => s + r.qty, 0), [rows]);
  const totalDiscount = useMemo(() => rows.reduce((s, r) => s + r.discountAmt, 0), [rows]);
  const totalTax = useMemo(() => rows.reduce((s, r) => s + r.taxAmt, 0), [rows]);
  const totalAmount = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  const subtotal = useMemo(() => rows.reduce((s, r) => s + r.qty * r.price, 0), [rows]);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const grandTotal = totalAmount;
  const balanceDue = grandTotal - advance;

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleSave = async () => {
    if (!selectedCustomerId) { toast.error('Select a customer'); return; }
    const validRows = rows.filter((r) => r.name && r.qty > 0);
    if (validRows.length === 0) { toast.error('Add at least one item'); return; }

    if (docType === 'Tax Invoice') {
      for (const row of validRows) {
        const item = items.find((i) => i.name === row.name);
        if (item && row.qty > item.stock) {
          toast.error(`Insufficient stock for "${row.name}". Available: ${item.stock}`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const result = await addSale({
        party_name: selectedCustomer?.name,
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        vehicle_number: vehicleNumber,
        eway_number: ewayNumber,
        gst_number: gstNumber,
        items: validRows.map((r) => ({
          name: r.name, hsn: r.hsn, description: r.description,
          qty: r.qty, unit: r.unit, price: r.price,
          discount_pct: r.discountPct, discount_amt: r.discountAmt,
          tax_pct: r.taxPct, tax_amt: r.taxAmt, amount: r.amount,
        })),
        notes,
        advance_payment: advance,
        doc_type: docType,
      });
      toast.success(`${docType} saved! Opening PDF...`);
      window.open(`${import.meta.env.VITE_API_URL || ''}/api/invoice_pdf/${result.id}`, '_blank');
      setRows([emptyRow()]);
      setSelectedCustomerId('');
      setBillingAddress(''); setShippingAddress(''); setVehicleNumber(''); setEwayNumber(''); setGstNumber('');
      setNotes(''); setAdvance(0);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Doc Type Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-muted rounded-xl p-1">
          {(['Tax Invoice', 'Estimation'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setDocType(type)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                docType === type
                  ? type === 'Tax Invoice'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-violet-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
        <Badge variant="outline" className="text-xs">
          {docType === 'Tax Invoice' ? 'Deducts stock on save' : 'Does not affect stock'}
        </Badge>
      </div>

      <div className="space-y-5">
        <div className="space-y-5">

          {/* Customer & Header Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Customer & Header Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Select Customer *</Label>
                  <CustomerCombobox
                    customers={customers}
                    value={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>GSTIN</Label>
                  <Input placeholder="Customer GSTIN" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vehicle Number</Label>
                  <Input placeholder="TN 00 XX 0000" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-Way Number</Label>
                  <Input placeholder="E-way bill number" value={ewayNumber} onChange={(e) => setEwayNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Address</Label>
                  <Input placeholder="Billing address" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Shipping Address</Label>
                  <Input placeholder="Shipping address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-muted/60 border-b">
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-8">#</th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground min-w-[160px]">ITEM</th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-[80px]">HSN CODE</th>
                      <th className="px-2 py-2 text-left font-semibold text-muted-foreground min-w-[100px]">DESCRIPTION</th>
                      <th className="px-2 py-2 text-center font-semibold text-muted-foreground w-[55px]">QTY</th>
                      <th className="px-2 py-2 text-center font-semibold text-muted-foreground w-[70px]">UNIT</th>
                      {/* Price/Unit with sub-label */}
                      <th className="px-2 py-2 text-center font-semibold text-muted-foreground w-[90px]">
                        <div>PRICE/UNIT</div>
                        <div className="text-[10px] font-normal text-muted-foreground/70">Without Tax</div>
                      </th>
                      {/* Discount group */}
                      <th className="px-0 py-0 text-center font-semibold text-muted-foreground" colSpan={2}>
                        <div className="border-b px-2 py-1">DISCOUNT</div>
                        <div className="flex">
                          <span className="flex-1 px-2 py-1 border-r text-[10px] font-normal">%</span>
                          <span className="flex-1 px-2 py-1 text-[10px] font-normal">AMOUNT</span>
                        </div>
                      </th>
                      {/* Tax group */}
                      <th className="px-0 py-0 text-center font-semibold text-muted-foreground" colSpan={2}>
                        <div className="border-b px-2 py-1">TAX</div>
                        <div className="flex">
                          <span className="flex-1 px-2 py-1 border-r text-[10px] font-normal">%</span>
                          <span className="flex-1 px-2 py-1 text-[10px] font-normal">AMOUNT</span>
                        </div>
                      </th>
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground w-[80px]">AMOUNT</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/20 group">
                        {/* # + drag handle */}
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3 text-muted-foreground/40 cursor-grab" />
                            <span className="text-muted-foreground">{idx + 1}</span>
                          </div>
                        </td>

                        {/* Item select */}
                        <td className="px-1 py-1">
                          <Select value={row.itemId} onValueChange={(v) => selectItem(idx, v)}>
                            <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-1 focus:ring-primary min-w-[150px]">
                              <SelectValue placeholder="Select item..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-52">
                              {sortedItems.map((item) => (
                                <SelectItem
                                  key={item.id}
                                  value={item.id}
                                  disabled={item.stock === 0 && docType === 'Tax Invoice'}
                                >
                                  {item.name} ({item.stock})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* HSN Code - locked */}
                        <td className="px-1 py-1">
                          <Input value={HSN} disabled className="h-7 text-xs w-[72px] bg-muted/50 border-0 text-center" />
                        </td>

                        {/* Description */}
                        <td className="px-1 py-1">
                          <Input
                            placeholder="Description"
                            value={row.description}
                            onChange={(e) => updateRow(idx, { description: e.target.value })}
                            className="h-7 text-xs min-w-[90px] border-0 focus-visible:ring-1"
                          />
                        </td>

                        {/* Qty */}
                        <td className="px-1 py-1">
                          <Input
                            type="number" min={1}
                            value={row.qty}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateRow(idx, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="h-7 text-xs w-[48px] text-center border-0 focus-visible:ring-1"
                          />
                        </td>

                        {/* Unit */}
                        <td className="px-1 py-1">
                          <Select value={row.unit} onValueChange={(v) => updateRow(idx, { unit: v })}>
                            <SelectTrigger className="h-7 text-xs w-[65px] border-0 focus:ring-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Price/Unit */}
                        <td className="px-1 py-1">
                          <Input
                            type="number" min={0}
                            value={row.price || ''}
                            placeholder="0.00"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateRow(idx, { price: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs w-[80px] text-right border focus-visible:ring-1 border-blue-300 bg-blue-50/50"
                          />
                        </td>

                        {/* Discount % */}
                        <td className="px-1 py-1 border-l">
                          <Input
                            type="number" min={0} max={100}
                            value={row.discountPct || ''}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateDiscountPct(idx, parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs w-[48px] text-center border-0 focus-visible:ring-1"
                          />
                        </td>

                        {/* Discount Amount */}
                        <td className="px-1 py-1 border-r">
                          <Input
                            type="number" min={0}
                            value={row.discountAmt || ''}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateDiscountAmt(idx, parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs w-[60px] text-right border-0 focus-visible:ring-1"
                          />
                        </td>

                        {/* Tax % select */}
                        <td className="px-1 py-1 border-l">
                          <Select
                            value={String(row.taxPct)}
                            onValueChange={(v) => updateRow(idx, { taxPct: parseInt(v) })}
                          >
                            <SelectTrigger className="h-7 text-xs w-[60px] border-0 focus:ring-1">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {TAX_RATES.map((r) => (
                                <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Tax Amount - readonly */}
                        <td className="px-1 py-1 border-r">
                          <Input
                            value={row.taxAmt.toFixed(2)}
                            readOnly
                            className="h-7 text-xs w-[60px] text-right border-0 bg-transparent text-muted-foreground"
                          />
                        </td>

                        {/* Final Amount */}
                        <td className="px-2 py-1 text-right font-semibold text-sm">
                          {row.amount.toFixed(2)}
                        </td>

                        {/* Delete */}
                        <td className="px-1 py-1">
                          <button
                            onClick={() => removeRow(idx)}
                            disabled={rows.length === 1}
                            className="h-6 w-6 flex items-center justify-center rounded text-destructive hover:bg-destructive/10 disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* TOTAL row */}
                    <tr className="bg-muted/40 font-semibold border-t-2">
                      <td colSpan={2} className="px-2 py-2">
                        <Button size="sm" variant="outline" onClick={addRow} className="h-7 text-xs gap-1 border-blue-400 text-blue-600 hover:bg-blue-50">
                          <Plus className="h-3 w-3" /> ADD ROW
                        </Button>
                      </td>
                      <td colSpan={2} className="px-2 py-2 text-xs font-bold text-muted-foreground">TOTAL</td>
                      <td className="px-2 py-2 text-center text-sm">{totalQty}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="px-2 py-2 text-right text-sm">{totalDiscount.toFixed(2)}</td>
                      <td></td>
                      <td className="px-2 py-2 text-right text-sm">{totalTax.toFixed(2)}</td>
                      <td className="px-2 py-2 text-right text-sm font-bold">{totalAmount.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1.5">
                <Label>Description / Notes</Label>
                <textarea
                  className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. *UNLOADING IS YOUR IN-CHARGE"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Summary */}
          <Card className="bg-[hsl(215,28%,17%)] text-white border-0">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-[hsl(214,32%,75%)] flex items-center gap-2 mb-4">
                <Receipt className="h-4 w-4" /> Billing Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Left: breakdown */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-[hsl(214,32%,75%)]">
                    <span>Subtotal (before tax)</span>
                    <span>{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[hsl(214,32%,75%)]">
                    <span>Discount</span>
                    <span>- {formatMoney(totalDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-[hsl(214,32%,75%)]">
                    <span>CGST</span>
                    <span>{formatMoney(cgst)}</span>
                  </div>
                  <div className="flex justify-between text-[hsl(214,32%,75%)]">
                    <span>SGST</span>
                    <span>{formatMoney(sgst)}</span>
                  </div>
                  <div className="border-t border-[hsl(215,25%,27%)] pt-2.5">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Grand Total</span>
                      <span>{formatMoney(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: advance + balance + save */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[hsl(214,32%,75%)] text-xs">Advance Payment (₹)</Label>
                    <Input
                      type="number" min={0}
                      value={advance || ''}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setAdvance(parseFloat(e.target.value) || 0)}
                      className="h-9 bg-[hsl(215,25%,27%)] border-[hsl(215,25%,35%)] text-white placeholder:text-white/30"
                    />
                  </div>
                  <div className="flex justify-between text-sm border-t border-[hsl(215,25%,27%)] pt-3">
                    <span className="text-[hsl(214,32%,75%)]">Balance Due</span>
                    <span className={`font-bold text-base ${balanceDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {formatMoney(balanceDue)}
                    </span>
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className={`w-full h-11 text-sm font-semibold gap-2 ${
                      docType === 'Tax Invoice'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-violet-600 hover:bg-violet-700'
                    }`}
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : `Save & Generate ${docType}`}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
