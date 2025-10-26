import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ColorWithVariantAndProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface CartItem {
  colorId: string;
  color: ColorWithVariantAndProduct;
  quantity: number;
  rate: number;
}

export default function POSSales() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [confirmQtyOpen, setConfirmQtyOpen] = useState(false);
  const [quantityToAdd, setQuantityToAdd] = useState(1);

  // Cart & customer
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amountPaid, setAmountPaid] = useState("");

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Data fetch
  const { data: colors = [], isLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  // Create sale mutation (same shape as your backend expects)
  const createSaleMutation = useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerPhone: string;
      totalAmount: number;
      amountPaid: number;
      paymentStatus: string;
      items: { colorId: string; quantity: number; rate: number; subtotal: number }[];
    }) => {
      const res = await apiRequest("POST", "/api/sales", data);
      return res.json();
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({ title: "Sale completed successfully" });
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setAmountPaid("");
      setLocation(`/bill/${sale.id}`);
    },
    onError: () => {
      toast({ title: "Failed to create sale", variant: "destructive" });
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // F2 -> focus search
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // Escape -> close confirm modal
      if (e.key === "Escape") {
        setConfirmQtyOpen(false);
        return;
      }
      // Ctrl+P -> Complete Paid Sale
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleCompleteSale(true);
        return;
      }
      // Ctrl+B -> Create Bill (Unpaid/Partial)
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleCompleteSale(false);
        return;
      }
      // Delete -> clear cart
      if (e.key === "Delete") {
        if (cart.length > 0 && confirm("Clear cart?")) setCart([]);
        return;
      }
      // Ctrl+F -> focus search
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, customerName, customerPhone, amountPaid]);

  // Search scoring & filtering (keeps exact/color-code first)
  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;
    const q = searchQuery.toLowerCase().trim();
    return colors
      .map((color) => {
        let score = 0;
        const colorCode = color.colorCode.toLowerCase();
        const colorName = color.colorName.toLowerCase();
        const company = color.variant.product.company.toLowerCase();
        const product = color.variant.product.productName.toLowerCase();
        const size = color.variant.packingSize.toLowerCase();

        if (colorCode === q) score += 1000;
        else if (colorCode.startsWith(q)) score += 500;
        else if (colorCode.includes(q)) score += 100;

        if (colorName === q) score += 200;
        else if (colorName.includes(q)) score += 50;

        if (company.includes(q)) score += 30;
        if (product.includes(q)) score += 30;
        if (size.includes(q)) score += 20;

        return { color, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ color }) => color);
  }, [colors, searchQuery]);

  // Cart operations
  const addToCart = (color: ColorWithVariantAndProduct, qty: number) => {
    if (color.stockQuantity === 0) {
      toast({ title: "Out of stock", variant: "destructive" });
      return;
    }
    const existing = cart.find((c) => c.colorId === color.id);
    if (existing) {
      setCart(cart.map((c) => c.colorId === color.id ? { ...c, quantity: c.quantity + qty } : c));
    } else {
      setCart([...cart, { colorId: color.id, color, quantity: qty, rate: parseFloat(color.variant.rate) }]);
    }
    toast({ title: `${qty} added to cart` });
    setConfirmQtyOpen(false);
    setQuantityToAdd(1);
    setSelectedColor(null);
    setSearchQuery("");
  };

  const updateQuantity = (colorId: string, delta: number) => {
    setCart(cart.map((it) => it.colorId === colorId ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
  };

  const removeFromCart = (colorId: string) => {
    setCart(cart.filter((it) => it.colorId !== colorId));
  };

  // Totals
  const subtotal = cart.reduce((s, it) => s + it.quantity * it.rate, 0);
  const tax = subtotal * 0.18; // 18% GST
  const total = subtotal + tax;

  // Complete sale
  const handleCompleteSale = (isPaid: boolean) => {
    if (!customerName || !customerPhone) {
      toast({ title: "Enter customer name & phone", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    const paid = isPaid ? total : parseFloat(amountPaid || "0");
    const paymentStatus = paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

    createSaleMutation.mutate({
      customerName,
      customerPhone,
      totalAmount: total,
      amountPaid: paid,
      paymentStatus,
      items: cart.map((it) => ({ colorId: it.colorId, quantity: it.quantity, rate: it.rate, subtotal: it.quantity * it.rate })),
    });
  };

  // Small helper for stock badge
  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of stock</Badge>;
    if (stock < 10) return <Badge variant="secondary">Low</Badge>;
    return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">In</Badge>;
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      {/* Top title + search */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">POS Sales</h1>
            <p className="text-sm text-gray-500 mt-1">Use <kbd className="bg-gray-100 px-2 py-0.5 rounded">F2</kbd> to focus search</p>
          </div>

          <div className="w-full md:w-1/2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search color code, name, product or company..."
                className="pl-10 h-12 shadow-sm"
                aria-label="Search products"
              />
            </div>
          </div>
        </div>

        {/* Main columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Products + Cart (span 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Products grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg p-4 shadow-sm">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                  </div>
                ))
              ) : ( (searchQuery ? filteredColors : colors).length === 0 ? (
                <div className="col-span-full bg-white rounded-lg p-8 text-center shadow-sm">
                  <Package2 className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No products found</p>
                </div>
              ) : (
                (searchQuery ? filteredColors : colors).map((color) => (
                  <Card key={color.id} className="flex flex-col justify-between h-full border hover:shadow-lg transition">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900 leading-tight">{color.variant.product.company}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{color.variant.product.productName}</p>
                          </div>
                          <div className="ml-2">{getStockBadge(color.stockQuantity)}</div>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge variant="secondary" className="text-xs font-mono bg-blue-50 text-blue-700">{color.colorCode}</Badge>
                          <Badge variant="outline" className="text-xs bg-gray-100">{color.variant.packingSize}</Badge>
                        </div>

                        <p className="text-base font-semibold text-gray-800 mb-1">{color.colorName}</p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="text-base font-semibold text-gray-900">Rs. {Math.round(parseFloat(color.variant.rate))}</div>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => {
                            setSelectedColor(color);
                            setQuantityToAdd(1);
                            setConfirmQtyOpen(true);
                          }}
                          disabled={color.stockQuantity === 0}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )) }
            </div>

            {/* Shopping Cart (below product grid) */}
            <Card className="shadow-sm">
              <CardHeader className="bg-white border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="h-5 w-5" />
                  Shopping Cart ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {cart.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
                    {cart.map((it) => (
                      <div key={it.colorId} className="p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 truncate">{it.color.variant.product.company}</h4>
                                <p className="text-xs text-gray-500 truncate">{it.color.variant.product.productName}</p>
                              </div>
                              <div className="ml-3 text-right">
                                <div className="text-sm font-semibold">Rs. {Math.round(it.quantity * it.rate)}</div>
                                <div className="text-xs text-gray-500">Rs. {Math.round(it.rate)} ea</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">{it.color.variant.packingSize}</Badge>
                              <Badge variant="outline" className="text-xs">{it.color.colorName}</Badge>
                              <Badge variant="outline" className="text-xs font-mono">{it.color.colorCode}</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(it.colorId, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <div className="w-10 text-center text-sm">{it.quantity}</div>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(it.colorId, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeFromCart(it.colorId)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Customer details + Totals */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="customerName" className="text-sm">Name</Label>
                  <Input id="customerName" className="h-10" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="customerPhone" className="text-sm">Phone Number</Label>
                  <Input id="customerPhone" type="tel" className="h-10" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="amountPaid" className="text-sm">Amount Paid (Optional)</Label>
                  <Input id="amountPaid" type="number" step="1" className="h-10" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
                </div>

                {/* Totals */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>Rs. {Math.round(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>GST (18%)</span>
                    <span>Rs. {Math.round(tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold mt-3">
                    <span>Total</span>
                    <span className="text-blue-600">Rs. {Math.round(total)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-3">
                  <Button className="w-full h-11 bg-green-600 hover:bg-green-700" onClick={() => handleCompleteSale(true)} disabled={createSaleMutation.isPending || cart.length === 0}>
                    Complete Sale (Ctrl+P)
                  </Button>
                  <Button variant="outline" className="w-full h-11" onClick={() => handleCompleteSale(false)} disabled={createSaleMutation.isPending || cart.length === 0}>
                    Create Bill (Ctrl+B)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Optional small actions card */}
            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="flex items-center gap-2"><kbd className="bg-gray-100 px-2 py-0.5 rounded">F2</kbd> Search</span>
                  <span className="text-xs">Quick keys</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => { setCart([]); toast({ title: "Cart cleared" }); }}>Clear Cart</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Quantity Confirmation Dialog */}
      <Dialog open={confirmQtyOpen} onOpenChange={setConfirmQtyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Quantity</DialogTitle>
            <DialogDescription>
              Add quantity for <span className="font-semibold">{selectedColor?.colorCode}</span>
            </DialogDescription>
          </DialogHeader>

          {selectedColor && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-sm font-medium">{selectedColor.variant.product.company} — {selectedColor.variant.product.productName}</div>
                <div className="text-xs text-gray-500">{selectedColor.colorName} ({selectedColor.colorCode}) • {selectedColor.variant.packingSize}</div>
                <div className="mt-2 text-sm font-semibold">Rs. {Math.round(parseFloat(selectedColor.variant.rate))}</div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button size="icon" variant="outline" onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}><Minus className="h-4 w-4" /></Button>
                <Input type="number" className="w-20 text-center" value={quantityToAdd} onChange={(e) => setQuantityToAdd(Math.max(1, parseInt(e.target.value) || 1))} />
                <Button size="icon" variant="outline" onClick={() => setQuantityToAdd(quantityToAdd + 1)}><Plus className="h-4 w-4" /></Button>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setConfirmQtyOpen(false)}>Cancel</Button>
                <Button onClick={() => addToCart(selectedColor, quantityToAdd)}>Add {quantityToAdd}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
