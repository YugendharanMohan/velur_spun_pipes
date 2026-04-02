import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndianRupee, ShoppingCart, TrendingUp, AlertTriangle, FileText, Search, ChevronLeft, ChevronRight, Download, Calendar } from 'lucide-react';
import { useERPStore } from '@/lib/store';
import { formatMoney, formatDate, getStockStatus } from '@/lib/mock-data';

type FilterPreset = 'all' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';

function getDateRange(preset: FilterPreset, customFrom: string, customTo: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (preset === 'this_month')   return { from: new Date(y, m, 1),     to: new Date(y, m + 1, 0) };
  if (preset === 'last_month')   return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
  if (preset === 'this_quarter') {
    const q = Math.floor(m / 3);
    return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 0) };
  }
  if (preset === 'this_year')    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  if (preset === 'custom')       return {
    from: customFrom ? new Date(customFrom) : null,
    to:   customTo   ? new Date(customTo)   : null,
  };
  return { from: null, to: null };
}

const PAGE_SIZE = 10;

export default function Dashboard() {
  const { items, fetchInventory } = useERPStore();

  const [stats, setStats]       = useState({ total_revenue: 0, today_sales: 0, total_orders: 0 });
  const [allSales, setAllSales] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);

  const [preset, setPreset]       = useState<FilterPreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/dashboard_stats');
      setStats(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/sales?limit=5000');
      const data = await res.json();
      setAllSales(data.sales || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); fetchInventory(); loadSales(); }, [loadStats, fetchInventory, loadSales]);

  // ── client-side filter ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const { from, to } = getDateRange(preset, customFrom, customTo);
    const q = search.toLowerCase();
    return allSales.filter((s) => {
      if (q && !s.party_name?.toLowerCase().includes(q)) return false;
      if (from || to) {
        const d = new Date(s.created_at);
        if (from && d < from) return false;
        if (to   && d > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)) return false;
      }
      return true;
    });
  }, [allSales, preset, customFrom, customTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSales  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePreset = (v: FilterPreset) => { setPreset(v); setPage(1); };
  const handleSearch = (v: string)       => { setSearch(v); setPage(1); };

  const lowStock = items.filter((i) => i.stock < 20);

  const metricCards = [
    { title: 'Total Revenue',  value: formatMoney(stats.total_revenue), icon: IndianRupee, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Total Orders',   value: stats.total_orders,               icon: ShoppingCart, color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
    { title: "Today's Sales",  value: formatMoney(stats.today_sales),   icon: TrendingUp,   color: 'text-violet-500', bg: 'bg-violet-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {metricCards.map((m) => (
          <Card key={m.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{m.title}</p>
                <h3 className="text-2xl font-bold mt-1">{m.value}</h3>
              </div>
              <div className={`${m.bg} p-3 rounded-xl`}>
                <m.icon className={`h-6 w-6 ${m.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Sales History</CardTitle>
                  <a href={(import.meta.env.VITE_API_URL || '') + '/api/export_sales'}>
                    <Button variant="outline" size="sm" className="gap-1.5 h-9">
                      <Download className="h-4 w-4" /> CSV
                    </Button>
                  </a>
                </div>

                {/* Filters row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">Filter by:</span>

                  <Select value={preset} onValueChange={(v) => handlePreset(v as FilterPreset)}>
                    <SelectTrigger className="h-9 w-[160px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sale Invoices</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="this_quarter">This Quarter</SelectItem>
                      <SelectItem value="this_year">This Year</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>

                  {preset === 'custom' && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                        className="h-9 w-[140px] text-sm" />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                        className="h-9 w-[140px] text-sm" />
                    </div>
                  )}

                  <div className="relative ml-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search party..." className="pl-8 h-9 w-44 text-sm"
                      value={search} onChange={(e) => handleSearch(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Invoice No</TableHead>
                    <TableHead className="text-xs">Party Name</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Balance</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : pageSales.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No sales found</TableCell></TableRow>
                  ) : (
                    pageSales.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm text-muted-foreground">{formatDate(sale.created_at)}</TableCell>
                        <TableCell className="text-sm font-mono font-medium">{sale.invoice_number || sale.id.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="text-sm font-medium">{sale.party_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{sale.doc_type || 'Tax Invoice'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{formatMoney(sale.grand_total || 0)}</TableCell>
                        <TableCell className="text-sm">
                          <span className={sale.balance_due > 0 ? 'text-destructive font-semibold' : 'text-emerald-600 font-semibold'}>
                            {formatMoney(sale.balance_due || 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <a href={`${import.meta.env.VITE_API_URL || ''}/api/invoice_pdf/${sale.id}`}
                            target="_blank" rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-primary text-primary-foreground h-7 px-2.5 hover:bg-primary/90">
                            <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                          </a>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between p-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <span className="text-sm text-muted-foreground">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} · Page {page} of {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">All items well stocked</p>
              ) : (
                lowStock.map((item) => {
                  const status = getStockStatus(item.stock);
                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(item.price)}</p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-xs ml-2 ${
                        status.variant === 'destructive'
                          ? 'bg-destructive/10 text-destructive border-destructive/30'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                      }`}>
                        {item.stock} left
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
