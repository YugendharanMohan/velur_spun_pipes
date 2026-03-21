import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IndianRupee,
  ShoppingCart,
  Clock,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  FileText,
  MessageCircle,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useERPStore } from "@/lib/store";
import { formatMoney, formatDate, getStockStatus } from "@/lib/mock-data";
import { sendWhatsApp } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function Dashboard() {
  const { sales, items, customerOrders, updateOrderStatus } = useERPStore();

  const handleApprove = async (id: string) => {
    if (window.confirm("Approve this order and send to production?")) {
      await updateOrderStatus(id, "Approved");
      toast.success("Order Approved");
    }
  };

  const handleReject = async (id: string, orderItems: any[]) => {
    if (window.confirm("Reject this order? Stock will be restored.")) {
      await updateOrderStatus(id, "Rejected", orderItems);
      toast.error("Order Rejected");
    }
  };



  // ML Predictions State
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(true);

  // Paginated Sales State
  const [salesPage, setSalesPage] = useState(1);
  const [salesSearch, setSalesSearch] = useState("");
  const [salesRemote, setSalesRemote] = useState<any[]>([]);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [loadingSales, setLoadingSales] = useState(true);

  // Paginated Active Orders State
  const [activePage, setActivePage] = useState(1);
  const [activeSearch, setActiveSearch] = useState("");
  const [activeRemote, setActiveRemote] = useState<any[]>([]);
  const [activeTotalPages, setActiveTotalPages] = useState(1);
  const [loadingActive, setLoadingActive] = useState(true);

  // Dashboard Metrics State
  const [dashboardStats, setDashboardStats] = useState({
    total_revenue: 0,
    today_sales: 0,
    total_orders: 0,
  });

  const loadDashboardStats = useCallback(async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/dashboard_stats');
      const data = await res.json();
      setDashboardStats(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  useEffect(() => {
    const loadPredictions = async () => {
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/ai_forecast');
        const data = await res.json();
        setPredictions(data.predictions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPredictions(false);
      }
    };
    loadPredictions();
  }, []);

  const [pendingRemote, setPendingRemote] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  const loadPendingOrders = useCallback(async () => {
    setLoadingPending(true);
    try {
      const res = await fetch(`\${import.meta.env.VITE_API_BASE_URL || ''}/api/pending_orders`);
      const data = await res.json();
      setPendingRemote(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    loadPendingOrders();
  }, [loadPendingOrders]);

  const loadSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const res = await fetch(`\${import.meta.env.VITE_API_BASE_URL || ''}/api/sales?page=${salesPage}&limit=10&search=${encodeURIComponent(salesSearch)}`);
      const data = await res.json();
      setSalesRemote(data.sales || []);
      setSalesTotalPages(data.total_pages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSales(false);
    }
  }, [salesPage, salesSearch]);

  useEffect(() => {
    const timeout = setTimeout(() => { loadSales(); }, 300);
    return () => clearTimeout(timeout);
  }, [loadSales]);

  const loadActiveOrders = useCallback(async () => {
    setLoadingActive(true);
    try {
      const res = await fetch(`\${import.meta.env.VITE_API_BASE_URL || ''}/api/active_orders?page=${activePage}&limit=10&search=${encodeURIComponent(activeSearch)}`);
      const data = await res.json();
      setActiveRemote(data.active_orders || []);
      setActiveTotalPages(data.total_pages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingActive(false);
    }
  }, [activePage, activeSearch]);

  useEffect(() => {
    const timeout = setTimeout(() => { loadActiveOrders(); }, 300);
    return () => clearTimeout(timeout);
  }, [loadActiveOrders]);

  // Reload stats whenever active orders change to keep them in sync
  useEffect(() => {
    loadDashboardStats();
  }, [activeRemote, pendingRemote, loadDashboardStats]);

  const totalRevenue = dashboardStats.total_revenue || 0;
  const totalOrders = dashboardStats.total_orders || 0;
  const pendingOrders = pendingRemote.length;
  const todaySales = dashboardStats.today_sales || 0;

  const lowStockItems = items.filter((i) => i.stock < 20);
  const recentSales = salesRemote.slice(0, 5);
  const pendingCustomerOrders = pendingRemote.slice(0, 5);

  const stats = [
    {
      title: "Total Revenue",
      value: formatMoney(totalRevenue),
      icon: IndianRupee,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      title: "Total Orders",
      value: totalOrders,
      icon: ShoppingCart,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Pending Orders",
      value: pendingOrders,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      title: "Today's Sales",
      value: formatMoney(todaySales),
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <Card className="hover:shadow-md transition-shadow duration-300">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {stat.title}
                    </p>
                    <h3 className="text-2xl font-bold mt-1 text-foreground">
                      {stat.value}
                    </h3>
                  </div>
                  <div className={`${stat.bg} p-3 rounded-xl`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Left Column (Active Orders + All Sales) */}
        <motion.div
          className="lg:col-span-2 space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          {/* Pending Orders List */}
          <Card className="border-l-[5px] border-l-warning">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                Request Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPending ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Loading pending orders...</TableCell></TableRow>
                  ) : pendingRemote.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No pending orders found</TableCell></TableRow>
                  ) : (
                    pendingRemote.map((order: any) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {order.party_name}
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          {formatMoney(order.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-primary/10 text-primary border-primary hover:bg-primary hover:text-white mr-2" onClick={async () => {
                            await handleApprove(order.id);
                            loadPendingOrders();
                            loadActiveOrders();
                          }}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-destructive/10 text-destructive border-destructive hover:bg-destructive hover:text-white" onClick={async () => {
                            await handleReject(order.id, order.items);
                            loadPendingOrders();
                          }}>
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Active Orders List */}
          <Card className="border-l-[5px] border-l-primary">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Active Production Orders
              </CardTitle>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search orders..."
                  className="w-full pl-8 h-9 text-sm"
                  value={activeSearch}
                  onChange={(e) => { setActiveSearch(e.target.value); setActivePage(1); }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingActive ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : activeRemote.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No active orders found</TableCell></TableRow>
                  ) : (
                    activeRemote.map((order: any) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {order.party_name}
                        </TableCell>
                        <TableCell className="text-sm font-semibold">
                          {formatMoney(order.total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${order.status === 'Approved' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-info/10 text-info border-info/20'}`}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-7 text-xs bg-success/10 text-success border-success hover:bg-success hover:text-white" onClick={() => {
                            if (order.status === "Approved") updateOrderStatus(order.id, "Ready").then(() => loadActiveOrders());
                            else if (order.status === "Ready") updateOrderStatus(order.id, "Completed").then(() => loadActiveOrders());
                          }}>
                            {order.status === "Approved" ? "Mark Ready" : "Dispatch"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between p-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setActivePage(p => Math.max(1, p - 1))} disabled={activePage === 1 || loadingActive}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <span className="text-sm text-muted-foreground">Page {activePage} of {activeTotalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setActivePage(p => Math.min(activeTotalPages, p + 1))} disabled={activePage === activeTotalPages || loadingActive}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales History List */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Sales History
              </CardTitle>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search sales..."
                  className="w-full pl-8 h-9 text-sm"
                  value={salesSearch}
                  onChange={(e) => { setSalesSearch(e.target.value); setSalesPage(1); }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Invoice</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSales ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading sales data...</TableCell></TableRow>
                  ) : salesRemote.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No sales history found</TableCell></TableRow>
                  ) : (
                    salesRemote.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-sm">
                          {sale.id}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.party_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(sale.created_at)}
                        </TableCell>
                        <TableCell className="font-semibold text-sm">
                          {formatMoney(sale.total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${sale.status === "Completed"
                              ? "bg-success/15 text-success border-success/30"
                              : sale.status === "Pending"
                                ? "bg-warning/15 text-warning border-warning/30"
                                : sale.status === "Approved"
                                  ? "bg-primary/15 text-primary border-primary/30"
                                  : "bg-success/10 text-success border-success/20"
                              }`}
                          >
                            {sale.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <a
                            href={`/api/invoice_pdf/${sale.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-primary text-primary-foreground h-7 px-3 py-1 mr-2 shadow-sm hover:bg-primary/90"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" /> PDF
                          </a>
                          <button
                            onClick={() => sendWhatsApp(sale.id, sale.party_name, formatDate(sale.created_at), sale.total)}
                            className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-[#25D366] text-primary-foreground h-7 px-3 py-1 shadow-sm hover:bg-[#20b858]"
                          >
                            <MessageCircle className="h-3.5 w-3.5 mr-1" /> WA
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between p-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setSalesPage(p => Math.max(1, p - 1))} disabled={salesPage === 1 || loadingSales}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <span className="text-sm text-muted-foreground">Page {salesPage} of {salesTotalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setSalesPage(p => Math.min(salesTotalPages, p + 1))} disabled={salesPage === salesTotalPages || loadingSales}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Low Stock Alerts + Pending Orders */}
        <motion.div
          className="space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {/* Low Stock */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockItems.slice(0, 5).map((item) => {
                const status = getStockStatus(item.stock);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(item.price)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${status.variant === "destructive"
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-warning/10 text-warning border-warning/30"
                        }`}
                    >
                      {item.stock} left
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Pending Customer Orders */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Pending Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingCustomerOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pending orders
                </p>
              ) : (
                pendingCustomerOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{order.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {formatMoney(order.total)}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-xs ${order.status === "Pending"
                          ? "bg-warning/15 text-warning border-warning/30"
                          : "bg-primary/15 text-primary border-primary/30"
                          }`}
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ML Forecast Table Bottom */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <Card className="border-l-[5px] border-l-success">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-success" />
                ML Demand Forecast
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Based on synthetic data generation from previous sales patterns.</p>
            </div>
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              Powered by GAN & Random Forest
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Item Name</TableHead>
                  <TableHead className="text-xs">Predicted Qty Needed</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPredictions ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm py-8 text-muted-foreground">
                      Analyzing 1,000 recent sales via AI model...
                    </TableCell>
                  </TableRow>
                ) : predictions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm py-8 text-muted-foreground">
                      Not enough data to generate predictions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  predictions.map((p, idx) => {
                    const isHighDemand = p.predicted_qty > 50;
                    return (
                      <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium text-sm">{p.item_name}</TableCell>
                        <TableCell className="text-sm">{p.predicted_qty} units</TableCell>
                        <TableCell>
                          <span className={`text-xs font-bold ${isHighDemand ? 'text-destructive' : 'text-success'}`}>
                            {isHighDemand ? 'High Demand' : 'Normal'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
