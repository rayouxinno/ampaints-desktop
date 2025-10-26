import { useState, useMemo, useEffect } from "react";
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [rate, setRate] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const { toast } = useToast();

  const { data: colors = [], isLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  // 🔍 Filter products
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

  // 🛒 Cart logic
  const addToCart = (color: ColorWithVariantAndProduct, qty = 1, customRate?: number) => {
    const rateToUse = customRate ?? parseFloat(color.variant.rate);
    const existing = cart.find((i) => i.colorId === color.id);
    if (existing) {
      setCart(
        cart.map((i) =>
          i.colorId === color.id
            ? { ...i, quantity: i.quantity + qty, rate: rateToUse }
            : i
        )
      );
    } else {
      setCart([...cart, { colorId: color.id, color, quantity: qty, rate: rateToUse }]);
    }
    toast({ title: "Added to cart" });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(
      cart.map((i) =>
        i.colorId === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
      )
    );
  };
  const removeItem = (id: string) => setCart(cart.filter((i) => i.colorId !== id));

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.rate, 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  const createSale = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sales", data);
      return await res.json();
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
    onError: () => toast({ title: "Failed to create sale", variant: "destructive" }),
  });

  const handleComplete = (isPaid: boolean) => {
    if (!customerName || !customerPhone) {
      toast({ title: "Enter customer details", variant: "destructive" });
      return;
    }
    if (!cart.length) {
      toast({ title: "Cart empty", variant: "destructive" });
      return;
    }
    const paid = isPaid ? total : parseFloat(amountPaid || "0");
    const status = paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";
    createSale.mutate({
      customerName,
      customerPhone,
      totalAmount: total,
      amountPaid: paid,
      paymentStatus: status,
      items: cart.map((i) => ({
        colorId: i.colorId,
        quantity: i.quantity,
        rate: i.rate,
        subtotal: i.quantity * i.rate,
      })),
    });
  };

  // ⌨️ Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleComplete(true);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleComplete(false);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart, customerName, customerPhone, amountPaid]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">POS Sales</h1>
        <p className="text-gray-500">Press <b>F2</b> to search products</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-gray-50">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5" />
                Shopping Cart ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cart.length === 0 ? (
                <div className="py-16 text-center text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-y-auto">
                  {cart.map((i) => (
                    <div key={i.colorId} className="flex justify-between p-4 border-b">
                      <div>
                        <h4 className="font-semibold text-sm">{i.color.variant.product.company}</h4>
                        <p className="text-xs text-gray-600">{i.color.variant.product.productName}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">{i.color.colorCode}</Badge>
                          <Badge variant="outline" className="text-xs">{i.color.variant.packingSize}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1 mb-1">
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(i.colorId, -1)}><Minus className="h-3 w-3" /></Button>
                          <span className="text-sm font-medium w-6 text-center">{i.quantity}</span>
                          <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(i.colorId, 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                        <p className="text-sm font-semibold">Rs. {Math.round(i.quantity * i.rate)}</p>
                        <Button size="icon" variant="ghost" className="text-red-500 h-6 w-6 mt-1" onClick={() => removeItem(i.colorId)}>
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

        {/* Customer */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              <div>
                <Label>Amount Paid (optional)</Label>
                <Input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              </div>
              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>Rs. {Math.round(subtotal)}</span></div>
                <div className="flex justify-between"><span>GST (18%)</span><span>Rs. {Math.round(tax)}</span></div>
                <div className="flex justify-between font-bold text-blue-600"><span>Total</span><span>Rs. {Math.round(total)}</span></div>
              </div>
              <div className="pt-3 space-y-2">
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleComplete(true)}>Complete Sale (Ctrl+P)</Button>
                <Button variant="outline" className="w-full" onClick={() => handleComplete(false)}>Create Bill (Ctrl+B)</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Search Products</DialogTitle>
            <DialogDescription>Type and press Enter or click product to add instantly.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col">
            <Input
              placeholder="Search color code, name, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 text-lg mb-4"
              autoFocus
            />
            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : filteredColors.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">No products found</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                {filteredColors.map((c) => (
                  <Card key={c.id} className="hover:shadow-md transition cursor-pointer"
                    onClick={() => { addToCart(c, 1); }}>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm">{c.variant.product.company}</h3>
                      <p className="text-xs text-gray-600">{c.variant.product.productName}</p>
                      <div className="flex gap-1">
                        <Badge variant="outline">{c.colorCode}</Badge>
                        <Badge variant="outline">{c.variant.packingSize}</Badge>
                      </div>
                      <p className="font-semibold">Rs. {c.variant.rate}</p>
                      <p className="text-xs text-gray-500">In Stock: {c.stockQuantity}</p>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedColor(c); setQuantity(1); setRate(parseFloat(c.variant.rate)); setConfirmOpen(true); }}>Add</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Qty + Rate Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Quantity & Rate</DialogTitle>
            <DialogDescription>{selectedColor?.colorCode} - {selectedColor?.colorName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Label>Quantity</Label>
            <div className="flex items-center justify-center gap-2">
              <Button size="icon" variant="outline" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></Button>
              <Input type="number" className="w-20 text-center" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
              <Button size="icon" variant="outline" onClick={() => setQuantity(quantity + 1)}><Plus className="h-4 w-4" /></Button>
            </div>
            <Label>Rate</Label>
            <Input type="number" className="w-full" value={rate} onChange={(e) => setRate(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => { if (selectedColor) addToCart(selectedColor, quantity, rate); setConfirmOpen(false); }}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
