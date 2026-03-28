import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndianRupee, ShoppingCart, TrendingUp, AlertTriangle, FileText, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useERPStore } from '@/lib/store';
import { formatMoney, formatDate, getStockStatus } from '@/lib/mock-data';
import { toast } from 'sonner';

export default function Dashboard() {
  const { items, fetchInventory } = useERPStore();

  const [stats, setStats] = useState({ total_revenue: 0, today_sales: 0, total_orders: 0 });
  const [sales, setSales] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/dashboard_stats');
      setStats(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        (import.meta.env.VITE_API_URL || '') +
        `/api/sales?page=${page}&limit=10&search=${encodeURIComponent(search)}`
      );
      const data = await res.json();
      setSales(data.sales || []);
      setTotalPages(data.total_pages || 1);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { loadStats(); fetchInventory(); }, [loadStats, fetchInventory]);
  useEffect(() => {
    const t = setTimeout(loadSales, 300);
    return () => clearTimeout(t);
  }, [loadSales]);

  const lowStock = items.filter((i) => i.stock < 20);

  const metricCards = [
    { title: 'Total Revenue', value: formatMoney(stats.total_revenue), icon: IndianRupee, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Total Orders', value: stats.total_orders, icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: "Today's Sales", value: formatMoney(stats.today_sales), icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-500/10' },
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
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Sales History</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative w-44">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    className="pl-8 h-9 text-sm"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <a href={(import.meta.env.VITE_API_URL || '') + '/api/export_sales'}>
                  <Button variant="outline" size="sm" className="gap-1.5 h-9">
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Invoice No</TableHead>
                    <TableHead className="text-xs">Party Name</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Balance</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sales found</TableCell></TableRow>
                  ) : (
                    sales.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm text-muted-foreground">{formatDate(sale.created_at)}</TableCell>
                        <TableCell className="text-sm font-mono font-medium">{sale.invoice_number || sale.id.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="text-sm font-medium">{sale.party_name}</TableCell>
                        <TableCell className="text-sm font-semibold">{formatMoney(sale.grand_total || 0)}</TableCell>
                        <TableCell className="text-sm">
                          <span className={sale.balance_due > 0 ? 'text-destructive font-semibold' : 'text-emerald-600 font-semibold'}>
                            {formatMoney(sale.balance_due || 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <a
                            href={`${import.meta.env.VITE_API_URL || ''}/api/invoice_pdf/${sale.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-primary text-primary-foreground h-7 px-2.5 hover:bg-primary/90"
                          >
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
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
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
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs ml-2 ${status.variant === 'destructive'
                          ? 'bg-destructive/10 text-destructive border-destructive/30'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        }`}
                      >
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
