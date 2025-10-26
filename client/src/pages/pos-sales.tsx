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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const { toast } = useToast();

  // For qty confirmation
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [confirmQtyOpen, setConfirmQtyOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Query data
  const { data: colors = [], isLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  // Mutation
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
    onError: () => {
      toast({ title: "Failed to create sale", variant: "destructive" });
    },
  });

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setConfirmQtyOpen(false);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleCompleteSale(true);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleCompleteSale(false);
      }
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Delete") {
        e.preventDefault();
        if (cart.length > 0 && confirm("Clear cart?")) setCart([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, customerName, customerPhone, amountPaid]);

  // Filtered colors
  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;
    const query = searchQuery.toLowerCase().trim();
    return colors
      .map((color) => {
        let score = 0;
        const colorCode = color.colorCode.toLowerCase();
        const colorName = color.colorName.toLowerCase();
        const company = color.variant.product.company.toLowerCase();
        const product = color.variant.product.productName.toLowerCase();
        const size = color.variant.packingSize.toLowerCase();
        if (colorCode === query) score += 1000;
        else if (colorCode.startsWith(query)) score += 500;
        else if (colorCode.includes(query)) score += 100;
        if (colorName === query) score += 200;
        else if (colorName.includes(query)) score += 50;
        if (company.includes(query)) score += 30;
        if (product.includes(query)) score += 30;
        if (size.includes(query)) score += 20;
        return { color, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ color }) => color);
  }, [colors, searchQuery]);

  // Add to cart
  const addToCart = (color: ColorWithVariantAndProduct, quantity: number) => {
    if (color.stockQuantity === 0) {
      toast({ title: "Out of stock", variant: "destructive" });
      return;
    }
    const existingItem = cart.find((item) => item.colorId === color.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.colorId === color.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          colorId: color.id,
          color,
          quantity,
          rate: parseFloat(color.variant.rate),
        },
      ]);
    }
    toast({ title: `${quantity} item${quantity > 1 ? "s" : ""} added to cart` });
    setSearchOpen(false);
    setSearchQuery("");
    setConfirmQtyOpen(false);
    setQuantityToAdd(1);
    setSelectedColor(null);
  };

  const updateQuantity = (colorId: string, delta: number) => {
    setCart(
      cart.map((item) =>
        item.colorId === colorId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const removeFromCart = (colorId: string) => {
    setCart(cart.filter((item) => item.colorId !== colorId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  const handleCompleteSale = (isPaid: boolean) => {
    if (!customerName || !customerPhone) {
      toast({ title: "Please enter customer name and phone number", variant: "destructive" });
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
      items: cart.map((item) => ({
        colorId: item.colorId,
        quantity: item.quantity,
        rate: item.rate,
        subtotal: item.quantity * item.rate,
      })),
    });
  };

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (stock < 10) return <Badge variant="secondary">Low Stock</Badge>;
    return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">In Stock</Badge>;
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT SIDE: Products Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">POS Sales</h1>
            <p className="text-gray-600">Use <kbd className="bg-gray-200 px-2 rounded">F2</kbd> to open search</p>
          </div>
        </div>

        {/* RIGHT SIDE: Cart & Customer Section */}
        <div className="flex flex-col h-[calc(100vh-3rem)] space-y-6 overflow-hidden">
          {/* Cart */}
          <Card className="flex-1 flex flex-col shadow-sm overflow-hidden">
            <CardHeader className="bg-gray-50 border-b shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5" />
                Shopping Cart ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {cart.map((item) => (
                    <div key={item.colorId} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-gray-900">
                            {item.color.variant.product.company}
                          </h4>
                          <p className="text-gray-600 text-xs mt-1">
                            {item.color.variant.product.productName}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge variant="outline" className="text-xs">{item.color.variant.packingSize}</Badge>
                            <Badge variant="outline" className="text-xs">{item.color.colorName}</Badge>
                            <Badge variant="outline" className="text-xs font-mono">{item.color.colorCode}</Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.colorId)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.colorId, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.colorId, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">Rs. {Math.round(item.quantity * item.rate)}</p>
                          <p className="text-xs text-gray-500">Rs. {Math.round(item.rate)} each</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {cart.length > 0 && (
              <div className="p-4 bg-gray-50 border-t shrink-0">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">Rs. {Math.round(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (18%)</span>
                    <span className="font-medium">Rs. {Math.round(tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span className="text-blue-600">Rs. {Math.round(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Customer Details */}
          <Card className="shadow-sm shrink-0">
            <CardHeader>
              <CardTitle className="text-lg">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="customerName" className="text-sm font-medium">Name</Label>
                <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10" />
              </div>
              <div>
                <Label htmlFor="customerPhone" className="text-sm font-medium">Phone Number</Label>
                <Input id="customerPhone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="h-10" />
              </div>
              <div>
                <Label htmlFor="amountPaid" className="text-sm font-medium">Amount Paid (Optional)</Label>
                <Input id="amountPaid" type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-3 pt-2">
                <Button className="w-full h-11 bg-green-600 hover:bg-green-700" onClick={() => handleCompleteSale(true)} disabled={createSaleMutation.isPending || cart.length === 0}>
                  Complete Sale (Ctrl+P)
                </Button>
                <Button variant="outline" className="w-full h-11 border-gray-300" onClick={() => handleCompleteSale(false)} disabled={createSaleMutation.isPending || cart.length === 0}>
                  Create Bill (Ctrl+B)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Product Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold">Search Products</DialogTitle>
            <DialogDescription>Type color code, name, or company</DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col overflow-hidden">
            <Input ref={searchInputRef} placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-12 text-base mb-4" autoFocus />

            {filteredColors.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Package2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-2 pb-4">
                {filteredColors.map((color) => (
                  <Card key={color.id} className="border hover:border-blue-400 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{color.variant.product.company}</h3>
                            <p className="text-gray-600 text-xs">{color.variant.product.productName}</p>
                          </div>
                          {getStockBadge(color.stockQuantity)}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge variant="secondary" className="text-xs font-mono bg-blue-100 text-blue-700">{color.colorCode}</Badge>
                          <Badge variant="outline" className="text-xs bg-gray-100">{color.variant.packingSize}</Badge>
                        </div>
                        <p className="text-lg font-bold text-gray-800 mb-1">{color.colorName}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-blue-600 font-semibold text-base">Rs. {color.variant.rate}</p>
                        <Button size="sm" className="h-8 px-3" onClick={() => { setSelectedColor(color); setConfirmQtyOpen(true); }}>
                          Add to Cart
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quantity Confirmation Dialog */}
      <Dialog open={confirmQtyOpen} onOpenChange={setConfirmQtyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Quantity</DialogTitle>
            <DialogDescription>
              Enter quantity for{" "}
              <span className="font-semibold">{selectedColor?.colorCode}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3 my-4">
            <Button size="icon" variant="outline" onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}>
              <Minus className="h-4 w-4" />
            </Button>
            <Input type="number" className="w-20 text-center" value={quantityToAdd} onChange={(e) => setQuantityToAdd(Math.max(1, parseInt(e.target.value) || 1))} />
            <Button size="icon" variant="outline" onClick={() => setQuantityToAdd(quantityToAdd + 1)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmQtyOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedColor && addToCart(selectedColor, quantityToAdd)}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
