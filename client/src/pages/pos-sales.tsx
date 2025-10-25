import { useState, useMemo } from "react";
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

  const { data: colors = [], isLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

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

  const addToCart = (color: ColorWithVariantAndProduct) => {
    if (color.stockQuantity === 0) {
      toast({ title: "Out of stock", variant: "destructive" });
      return;
    }
    
    const existingItem = cart.find((item) => item.colorId === color.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.colorId === color.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { colorId: color.id, color, quantity: 1, rate: parseFloat(color.variant.rate) }]);
    }
    toast({ title: "Added to cart" });
    setSearchOpen(false);
    setSearchQuery("");
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
    if (stock < 10) return <Badge variant="secondary">Low ({stock})</Badge>;
    return <Badge variant="default">Stock: {stock}</Badge>;
  };

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-full">
        {/* Left Side - Product Search */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-pos-title">
              POS Sales
            </h1>
            <p className="text-sm text-muted-foreground">Search by color code for fastest results</p>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by color code, name, product, or company..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value && !searchOpen) setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              data-testid="input-search-products"
              className="pl-10 h-12"
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : colors.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Package2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No products available. Add colors in Stock Management first.</p>
              </CardContent>
            </Card>
          ) : null}

          {/* Search Dialog */}
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Search Products</DialogTitle>
                <DialogDescription>
                  Exact color code matches appear first
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Type color code, name, product..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-dialog-search"
                  className="w-full"
                  autoFocus
                />
                {filteredColors.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No products found matching "{searchQuery}"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                    {filteredColors.map((color) => (
                      <Card key={color.id} className="hover-elevate cursor-pointer" data-testid={`search-result-${color.id}`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 space-y-2">
                              <div>
                                <p className="font-semibold text-sm">{color.variant.product.company}</p>
                                <p className="text-xs text-muted-foreground">{color.variant.product.productName}</p>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-xs">{color.variant.packingSize}</Badge>
                                <Badge variant="secondary" className="text-xs font-mono font-semibold">{color.colorCode}</Badge>
                              </div>
                              <p className="text-xs">{color.colorName}</p>
                              <div className="flex items-center justify-between">
                                <p className="text-base font-semibold">Rs. {Math.round(parseFloat(color.variant.rate))}</p>
                                {getStockBadge(color.stockQuantity)}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => addToCart(color)}
                              disabled={color.stockQuantity === 0}
                              data-testid={`button-add-${color.id}`}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add
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
        </div>

        {/* Right Side - Cart & Checkout */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {cart.map((item) => (
                    <Card key={item.colorId} data-testid={`cart-item-${item.colorId}`}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium">{item.color.variant.product.company}</p>
                            <p className="text-xs text-muted-foreground">{item.color.variant.product.productName}</p>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-xs">{item.color.variant.packingSize}</Badge>
                              <Badge variant="outline" className="text-xs">{item.color.colorName}</Badge>
                              <Badge variant="outline" className="text-xs font-mono">{item.color.colorCode}</Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.colorId)}
                            data-testid={`button-remove-${item.colorId}`}
                            className="h-8 w-8 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.colorId, -1)}
                              data-testid={`button-decrease-${item.colorId}`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium w-8 text-center" data-testid={`quantity-${item.colorId}`}>
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.colorId, 1)}
                              data-testid={`button-increase-${item.colorId}`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Rs. {Math.round(item.rate)} each</p>
                            <p className="text-sm font-semibold" data-testid={`subtotal-${item.colorId}`}>
                              Rs. {Math.round(item.quantity * item.rate)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span data-testid="text-subtotal">Rs. {Math.round(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>GST (18%)</span>
                    <span data-testid="text-tax">Rs. {Math.round(tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span data-testid="text-total">Rs. {Math.round(total)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="customerName" className="text-sm">Name</Label>
                <Input
                  id="customerName"
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  data-testid="input-customer-name"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customerPhone" className="text-sm">Phone Number</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  placeholder="Phone number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  data-testid="input-customer-phone"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountPaid" className="text-sm">Amount Paid (Optional)</Label>
                <Input
                  id="amountPaid"
                  type="number"
                  step="1"
                  placeholder="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  data-testid="input-amount-paid"
                  className="h-10"
                />
              </div>
              <div className="space-y-2 pt-2">
                <Button
                  className="w-full h-11"
                  onClick={() => handleCompleteSale(true)}
                  disabled={createSaleMutation.isPending || cart.length === 0}
                  data-testid="button-complete-sale"
                >
                  Complete Sale (Paid)
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleCompleteSale(false)}
                  disabled={createSaleMutation.isPending || cart.length === 0}
                  data-testid="button-partial-sale"
                >
                  Create Bill (Unpaid/Partial)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
