import { useEffect, useMemo, useRef, useState } from "react";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Search, Plus, Minus, Trash2, ShoppingCart, Package2 } from "lucide-react";
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

  // Cart + Customer
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amountPaid, setAmountPaid] = useState("");

  // Search modal
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [confirmQty, setConfirmQty] = useState(1);
  const [confirmRate, setConfirmRate] = useState<number | "">("");

  // Load colors
  const { data: colors = [], isLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  // Filter
  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;
    const q = searchQuery.toLowerCase().trim();
    return colors.filter(
      (c) =>
        c.colorCode.toLowerCase().includes(q) ||
        c.colorName.toLowerCase().includes(q) ||
        c.variant.product.productName.toLowerCase().includes(q) ||
        c.variant.product.company.toLowerCase().includes(q)
    );
  }, [colors, searchQuery]);

  // GST toggle (you can later connect to settings)
  const enableGST = false;
  const subtotal = cart.reduce((s, i) => s + i.quantity * i.rate, 0);
  const tax = enableGST ? subtotal * 0.18 : 0;
  const total = subtotal + tax;

  // Mutation
  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
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

  // Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
        return;
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setConfirmOpen(false);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleCompleteSale(true);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleCompleteSale(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, customerName, customerPhone, amountPaid]);

  // Cart functions
  const addToCart = (color: ColorWithVariantAndProduct, qty = 1, rate?: number) => {
    const effectiveRate = rate ?? parseFloat(color.variant.rate);
    setCart((prev) => {
      const existing = prev.find((p) => p.colorId === color.id);
      if (existing) {
        return prev.map((p) =>
          p.colorId === color.id ? { ...p, quantity: p.quantity + qty, rate: effectiveRate } : p
        );
      }
      return [...prev, { colorId: color.id, color, quantity: qty, rate: effectiveRate }];
    });
    toast({ title: `${qty} x ${color.colorName} added to cart` });
  };

  const openConfirmFor = (color: ColorWithVariantAndProduct) => {
    setSelectedColor(color);
    setConfirmQty(1);
    setConfirmRate(Number(color.variant.rate) || "");
    setConfirmOpen(true);
  };

  const confirmAdd = () => {
    if (!selectedColor) return;
    const qty = Math.max(1, Math.floor(confirmQty));
    const r = Number(confirmRate) || parseFloat(selectedColor.variant.rate);
    addToCart(selectedColor, qty, r);
    setConfirmOpen(false);
    setSelectedColor(null);
    setConfirmQty(1);
    setConfirmRate("");
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((it) =>
        it.colorId === id ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it
      )
    );
  };
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((it) => it.colorId !== id));

  // Sale complete
  const handleCompleteSale = (isPaid: boolean) => {
    if (!customerName || !customerPhone) {
      toast({ title: "Please enter customer name and phone", variant: "destructive" });
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
      items: cart.map((it) => ({
        colorId: it.colorId,
        quantity: it.quantity,
        rate: it.rate,
        subtotal: it.quantity * it.rate,
      })),
    });
  };

  // Stock badge
  const stockBadge = (stock: number) => {
    if (stock <= 0) return <Badge variant="destructive">Out</Badge>;
    if (stock < 10) return <Badge variant="secondary">Low</Badge>;
    return (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
        In
      </Badge>
    );
  };

  // Confirm modal keys
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmAdd();
      }
      if (e.key === "Escape") {
        setConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, confirmQty, confirmRate, selectedColor]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header centered */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">POS Sales</h1>
          <p className="text-sm text-gray-500 mb-4">
            Use <kbd className="bg-gray-100 px-2 rounded">F2</kbd> to open search
          </p>
          <div className="flex justify-center">
            <div className="relative w-full max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search color code, name, or product..."
                className="pl-10 h-11 shadow-sm text-center"
                aria-label="Search products"
              />
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="bg-white border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart className="h-5 w-5" /> Shopping Cart ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <Package2 className="mx-auto mb-3 h-12 w-12 opacity-40" />
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {cart.map((it) => (
                      <div
                        key={it.colorId}
                        className="p-4 border-b last:border-b-0 flex items-start justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {it.color.variant.product.company}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {it.color.variant.product.productName}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                Rs. {Math.round(it.quantity * it.rate)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Rs. {Math.round(it.rate)} each
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mt-2 items-center">
                            <Badge variant="outline" className="text-xs">
                              {it.color.colorCode}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {it.color.variant.packingSize}
                            </Badge>
                            <div className="text-sm text-gray-700 ml-1">
                              {it.color.colorName}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(it.colorId, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <div className="w-10 text-center text-sm">{it.quantity}</div>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(it.colorId, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500"
                            onClick={() => removeFromCart(it.colorId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Side: Customer Details */}
          <div className="space-y-6">
            <Card className="sticky top-6 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label>Amount Paid (optional)</Label>
                  <Input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>Rs. {Math.round(subtotal)}</span>
                  </div>
                  {enableGST && (
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>GST (18%)</span>
                      <span>Rs. {Math.round(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold mt-3">
                    <span>Total</span>
                    <span className="text-blue-600">Rs. {Math.round(total)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-3">
                  <Button
                    className="w-full h-11 bg-green-600 hover:bg-green-700"
                    onClick={() => handleCompleteSale(true)}
                    disabled={createSaleMutation.isLoading || cart.length === 0}
                  >
                    Complete Sale (Ctrl+P)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-11"
                    onClick={() => handleCompleteSale(false)}
                    disabled={createSaleMutation.isLoading || cart.length === 0}
                  >
                    Create Bill (Ctrl+B)
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <kbd className="bg-gray-100 px-2 rounded">F2</kbd> Search
                  </div>
                  <div className="text-xs">Shortcuts</div>
                </div>
                <div className="mt-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCart([]);
                      toast({ title: "Cart cleared" });
                    }}
                  >
                    Clear Cart
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Search Products</DialogTitle>
                <DialogDescription>
                  Type and press Enter or click product to add instantly.
                </DialogDescription>
              </div>
              <Button variant="ghost" onClick={() => setSearchOpen(false)}>
                Close
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 flex flex-col mt-2">
            <div className="mb-4">
              <Input
                placeholder="Search color code, name, product or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 text-lg shadow-sm"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-36 bg-white rounded-lg p-4 shadow-sm">
                      <Skeleton className="h-6 w-2/3 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredColors.length === 0 ? (
                <div className="text-center text-gray-500 mt-12">No products found</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredColors.map((color) => (
                    <Card
                      key={color.id}
                      className="cursor-pointer hover:shadow-md transition p-3 border border-gray-100"
                      onClick={() => openConfirmFor(color)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-800 text-sm">
                            {color.variant.product.productName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {color.variant.product.company}
                          </div>
                        </div>
                        {stockBadge(color.stock)}
                      </div>

                      <div className="mt-2 text-xs text-gray-600 flex flex-wrap gap-2">
                        <Badge variant="outline">{color.colorCode}</Badge>
                        <Badge variant="outline">{color.variant.packingSize}</Badge>
                        <span>{color.colorName}</span>
                      </div>

                      <div className="mt-3 font-semibold text-blue-600">
                        Rs. {color.variant.rate}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Add Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          {selectedColor && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">{selectedColor.colorName}</div>
                <div className="text-xs text-gray-500">
                  {selectedColor.variant.product.productName} -{" "}
                  {selectedColor.variant.product.company}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => setConfirmQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    value={confirmQty}
                    onChange={(e) => setConfirmQty(Number(e.target.value))}
                    className="w-16 text-center h-8"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    onClick={() => setConfirmQty((q) => q + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  type="number"
                  placeholder="Rate"
                  value={confirmRate}
                  onChange={(e) => setConfirmRate(e.target.value ? Number(e.target.value) : "")}
                  className="w-28 h-8 text-center"
                />
              </div>
              <Button className="w-full" onClick={confirmAdd}>
                Add to Cart
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
