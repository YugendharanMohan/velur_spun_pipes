import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ShoppingCart, Plus, Trash2, Package, Clock, CheckCircle, LogOut, Sparkles
} from "lucide-react";
import { useERPStore } from "@/lib/store";
import { formatMoney, formatDate } from "@/lib/mock-data";
import { sortProductsByDiameter } from "@/lib/utils";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";

export default function CustomerPortal() {
  const { items, customerOrders, customerOrdersTotalPages, customerOrdersCurrentPage, fetchInventory, fetchCustomerOrders, addSale } = useERPStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchInventory();
    if (user?.email) {
      fetchCustomerOrders(user.email, 1, 10);
    }
  }, [fetchInventory, fetchCustomerOrders, user?.email]);

  const [activeType, setActiveType] = useState<"Order" | "Estimate">("Order");
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<{ name: string; price: number; qty: number }[]>([]);

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const [recommendations, setRecommendations] = useState<{ name: string, price: number }[]>([]);

  useEffect(() => {
    if (!selectedItem) {
      setRecommendations([]);
      return;
    }
    const item = items.find((i) => i.id === selectedItem);
    if (!item) return;

    fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: item.name })
    })
      .then(res => res.json())
      .then(data => {
        if (data.recommendations) {
          setRecommendations(data.recommendations);
        } else {
          setRecommendations([]);
        }
      })
      .catch(() => setRecommendations([]));
  }, [selectedItem, items]);

  const addRecommendation = (recName: string, recPrice: number) => {
    const existing = cart.find((c) => c.name === recName);
    if (existing) {
      setCart(cart.map((c) => (c.name === recName ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([...cart, { name: recName, price: recPrice, qty: 1 }]);
    }
    toast.success(`Recommended item added!`);
  };

  const addToCart = () => {
    if (!selectedItem) {
      toast.error("Select a product");
      return;
    }
    const item = items.find((i) => i.id === selectedItem);
    if (!item) return;

    if (activeType === "Order" && qty > item.stock) {
      toast.error(`Insufficient stock! Only ${item.stock} available.`);
      return;
    }

    const existing = cart.find((c) => c.name === item.name);
    if (existing) {
      setCart(cart.map((c) => (c.name === item.name ? { ...c, qty: c.qty + qty } : c)));
    } else {
      setCart([...cart, { name: item.name, price: item.price, qty }]);
    }
    setSelectedItem("");
    setQty(1);
  };

  const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      await addSale({
        party_name: user?.name || "Customer",
        customer_email: user?.email || "customer@example.com",
        items: cart.map((i) => ({
          name: i.name,
          qty: i.qty,
          price: i.price,
          total: i.price * i.qty,
        })),
        total: cartTotal,
        status: "Pending",
        doc_type: activeType === "Order" ? "Tax Invoice" : "Estimation",
        created_at: new Date().toISOString().split("T")[0],
      });
      toast.success("Order placed successfully! Status: Pending Approval");
      setCart([]);
      if (user?.email) fetchCustomerOrders(user.email, 1, 10);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "Pending": return <Clock className="h-3.5 w-3.5" />;
      case "Approved": return <CheckCircle className="h-3.5 w-3.5" />;
      case "Ready": return <Package className="h-3.5 w-3.5" />;
      case "Completed": return <CheckCircle className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card shadow-sm">
        <div className="max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              VSP
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">Vellore Spun Pipes</h1>
              <p className="text-[10px] text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => { logout(); navigate("/portal/login"); }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Welcome */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Welcome, {user?.name || "Customer"}</h2>
            <p className="text-sm text-muted-foreground">Place orders and view your history</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex bg-muted rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveType("Order")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeType === "Order"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground"
              }`}
          >
            Place Order
          </button>
          <button
            onClick={() => setActiveType("Estimate")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeType === "Estimate"
              ? "bg-[hsl(263,69%,55%)] text-white shadow-md"
              : "text-muted-foreground"
              }`}
          >
            Get Estimate
          </button>
        </div>

        <div className="space-y-6 lg:space-y-8">
          {/* Product Selection */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Select Products</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedItem} onValueChange={setSelectedItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Select Product --" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortProductsByDiameter(items).map((item) => (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        disabled={activeType === "Order" && item.stock < 1}
                      >
                        {item.name} ({formatMoney(item.price)})
                        {activeType === "Order" && ` - Stock: ${item.stock}`}
                        {activeType === "Order" && item.stock < 1 && " [OUT OF STOCK]"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-3">
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                  <Button onClick={addToCart} className="gap-1.5 flex-1">
                    <Plus className="h-4 w-4" /> Add to Cart
                  </Button>
                </div>

                {recommendations.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2 overflow-hidden">
                    <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Recommended Additions
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recommendations.map((rec, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => addRecommendation(rec.name, rec.price)}
                          className="h-8 text-xs border-primary/30 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          + Add {rec.name}
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Cart */}
                {cart.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-semibold">Cart ({cart.length} items)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs text-center">Qty</TableHead>
                          <TableHead className="text-xs">Total</TableHead>
                          <TableHead className="text-xs w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{item.name}</TableCell>
                            <TableCell className="text-sm text-center">{item.qty}</TableCell>
                            <TableCell className="text-sm font-semibold">{formatMoney(item.price * item.qty)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeFromCart(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="font-semibold">Total: {formatMoney(cartTotal)}</span>
                      <Button onClick={placeOrder} className="gap-1.5">
                        <ShoppingCart className="h-4 w-4" />
                        {activeType === "Order" ? "Place Order" : "Request Estimate"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Order History */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Order History</CardTitle>
              </CardHeader>
              <CardContent>
                {customerOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
                ) : (
                  <div className="space-y-3">
                    {customerOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold">{order.id}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {order.items.length} item{order.items.length > 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{formatMoney(order.total)}</p>
                          <Badge
                            variant="outline"
                            className={`mt-1 text-xs gap-1 ${order.status === "Pending"
                              ? "bg-warning/15 text-warning border-warning/30"
                              : order.status === "Approved"
                                ? "bg-primary/15 text-primary border-primary/30"
                                : order.status === "Ready"
                                  ? "bg-success/10 text-success border-success/20"
                                  : "bg-success/15 text-success border-success/30"
                              }`}
                          >
                            {statusIcon(order.status)}
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {customerOrdersTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 border-t pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => user?.email && fetchCustomerOrders(user.email, customerOrdersCurrentPage - 1, 10)}
                      disabled={customerOrdersCurrentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground">
                      Page {customerOrdersCurrentPage} of {customerOrdersTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => user?.email && fetchCustomerOrders(user.email, customerOrdersCurrentPage + 1, 10)}
                      disabled={customerOrdersCurrentPage === customerOrdersTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
