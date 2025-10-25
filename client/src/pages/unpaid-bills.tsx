import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, Calendar, User, Phone, Plus, Trash2, Eye, Search, Banknote, Printer, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Sale, SaleWithItems, ColorWithVariantAndProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

type ConsolidatedCustomer = {
  customerPhone: string;
  customerName: string;
  bills: Sale[];
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  oldestBillDate: Date;
};

export default function UnpaidBills() {
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const { toast } = useToast();

  const { data: unpaidSales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales/unpaid"],
  });

  const { data: saleDetails, isLoading: isLoadingDetails } = useQuery<SaleWithItems>({
    queryKey: [`/api/sales/${selectedSaleId}`],
    enabled: !!selectedSaleId,
  });

  const { data: colors = [] } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: addProductDialogOpen,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { saleId: string; amount: number }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/payment`, { amount: data.amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Payment recorded successfully" });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
    },
    onError: () => {
      toast({ title: "Failed to record payment", variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { saleId: string; colorId: string; quantity: number; rate: number; subtotal: number }) => {
      return await apiRequest("POST", `/api/sales/${data.saleId}/items`, {
        colorId: data.colorId,
        quantity: data.quantity,
        rate: data.rate,
        subtotal: data.subtotal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Product added to bill" });
      setAddProductDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setSearchQuery("");
    },
    onError: () => {
      toast({ title: "Failed to add product", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (saleItemId: string) => {
      return await apiRequest("DELETE", `/api/sale-items/${saleItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Product removed from bill" });
    },
    onError: () => {
      toast({ title: "Failed to remove product", variant: "destructive" });
    },
  });

  const handleRecordPayment = async () => {
    if (!selectedCustomer || !paymentAmount) {
      toast({ title: "Please enter payment amount", variant: "destructive" });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast({ title: "Payment amount must be positive", variant: "destructive" });
      return;
    }

    // Check if payment exceeds outstanding
    if (amount > selectedCustomer.totalOutstanding) {
      toast({ 
        title: `Payment amount (Rs. ${Math.round(amount).toLocaleString()}) exceeds outstanding balance (Rs. ${Math.round(selectedCustomer.totalOutstanding).toLocaleString()})`, 
        variant: "destructive" 
      });
      return;
    }

    // Sort bills by date (oldest first) and apply payment
    const sortedBills = [...selectedCustomer.bills].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let remainingPayment = amount;
    const paymentsToApply: { saleId: string; amount: number }[] = [];

    for (const bill of sortedBills) {
      if (remainingPayment <= 0) break;
      
      const billTotal = parseFloat(bill.totalAmount);
      const billPaid = parseFloat(bill.amountPaid);
      const billOutstanding = billTotal - billPaid;
      
      if (billOutstanding > 0) {
        const paymentForThisBill = Math.min(remainingPayment, billOutstanding);
        paymentsToApply.push({ saleId: bill.id, amount: paymentForThisBill });
        remainingPayment -= paymentForThisBill;
      }
    }

    // Validate that we have payments to apply
    if (paymentsToApply.length === 0) {
      toast({ title: "No outstanding balance to apply payment to", variant: "destructive" });
      return;
    }

    // Apply all payments
    try {
      for (const payment of paymentsToApply) {
        await apiRequest("POST", `/api/sales/${payment.saleId}/payment`, { amount: payment.amount });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: `Payment of Rs. ${Math.round(amount).toLocaleString()} recorded successfully` });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setSelectedCustomerPhone(null);
    } catch (error) {
      toast({ title: "Failed to record payment", variant: "destructive" });
    }
  };

  const handleAddProduct = () => {
    if (!selectedColor || !selectedSaleId) {
      toast({ title: "Please select a product", variant: "destructive" });
      return;
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      toast({ title: "Quantity must be positive", variant: "destructive" });
      return;
    }

    if (qty > selectedColor.stockQuantity) {
      toast({ title: "Not enough stock available", variant: "destructive" });
      return;
    }

    const rate = parseFloat(selectedColor.variant.rate);
    const subtotal = rate * qty;

    addItemMutation.mutate({
      saleId: selectedSaleId,
      colorId: selectedColor.id,
      quantity: qty,
      rate,
      subtotal,
    });
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default">Paid</Badge>;
      case "partial":
        return <Badge variant="secondary">Partial</Badge>;
      case "unpaid":
        return <Badge variant="outline">Unpaid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDaysOverdue = (createdAt: string | Date) => {
    const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors;

    const query = searchQuery.toLowerCase();
    
    return colors
      .map((color) => {
        let score = 0;
        
        // Exact color code match (highest priority)
        if (color.colorCode.toLowerCase() === query) {
          score += 1000;
        } else if (color.colorCode.toLowerCase().startsWith(query)) {
          score += 500;
        } else if (color.colorCode.toLowerCase().includes(query)) {
          score += 100;
        }
        
        // Color name matching
        if (color.colorName.toLowerCase() === query) {
          score += 200;
        } else if (color.colorName.toLowerCase().includes(query)) {
          score += 50;
        }
        
        // Company and product matching
        if (color.variant.product.company.toLowerCase().includes(query)) {
          score += 30;
        }
        if (color.variant.product.productName.toLowerCase().includes(query)) {
          score += 30;
        }
        
        // Packing size matching
        if (color.variant.packingSize.toLowerCase().includes(query)) {
          score += 20;
        }
        
        return { color, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ color }) => color);
  }, [colors, searchQuery]);

  const currentSale = unpaidSales.find(s => s.id === selectedSaleId);

  const consolidatedCustomers = useMemo(() => {
    const customerMap = new Map<string, ConsolidatedCustomer>();
    
    unpaidSales.forEach(sale => {
      const phone = sale.customerPhone;
      const existing = customerMap.get(phone);
      
      const totalAmount = parseFloat(sale.totalAmount);
      const totalPaid = parseFloat(sale.amountPaid);
      const outstanding = totalAmount - totalPaid;
      const billDate = new Date(sale.createdAt);
      
      if (existing) {
        existing.bills.push(sale);
        existing.totalAmount += totalAmount;
        existing.totalPaid += totalPaid;
        existing.totalOutstanding += outstanding;
        if (billDate < existing.oldestBillDate) {
          existing.oldestBillDate = billDate;
        }
      } else {
        customerMap.set(phone, {
          customerPhone: phone,
          customerName: sale.customerName,
          bills: [sale],
          totalAmount,
          totalPaid,
          totalOutstanding: outstanding,
          oldestBillDate: billDate,
        });
      }
    });
    
    return Array.from(customerMap.values()).sort((a, b) => {
      return a.oldestBillDate.getTime() - b.oldestBillDate.getTime();
    });
  }, [unpaidSales]);

  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const selectedCustomer = consolidatedCustomers.find(c => c.customerPhone === selectedCustomerPhone);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-unpaid-bills-title">
          Unpaid Bills
        </h1>
        <p className="text-sm text-muted-foreground">Track and manage outstanding payments</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : consolidatedCustomers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No unpaid bills</h3>
            <p className="text-sm text-muted-foreground">All payments are up to date</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {consolidatedCustomers.map((customer) => {
            const daysOverdue = getDaysOverdue(customer.oldestBillDate);

            return (
              <Card key={customer.customerPhone} className="hover-elevate" data-testid={`unpaid-bill-customer-${customer.customerPhone}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{customer.customerName}</CardTitle>
                    {customer.bills.length > 1 && (
                      <Badge variant="secondary">{customer.bills.length} Bills</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{customer.customerPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{customer.oldestBillDate.toLocaleDateString()}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {daysOverdue} days ago
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border space-y-1 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span>Rs. {Math.round(customer.totalAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid:</span>
                      <span>Rs. {Math.round(customer.totalPaid).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base text-destructive">
                      <span>Outstanding:</span>
                      <span data-testid={`text-outstanding-${customer.customerPhone}`}>
                        Rs. {Math.round(customer.totalOutstanding).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setSelectedCustomerPhone(customer.customerPhone)}
                      data-testid={`button-view-details-${customer.customerPhone}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => {
                        setSelectedCustomerPhone(customer.customerPhone);
                        setPaymentDialogOpen(true);
                        setPaymentAmount(Math.round(customer.totalOutstanding).toString());
                      }}
                      data-testid={`button-record-payment-${customer.customerPhone}`}
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Customer Bills Details Dialog */}
      <Dialog open={!!selectedCustomerPhone && !paymentDialogOpen} onOpenChange={(open) => !open && setSelectedCustomerPhone(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Bills</DialogTitle>
            <DialogDescription>
              All unpaid bills for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-md text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedCustomer.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedCustomer.customerPhone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Bills</p>
                  <p className="font-medium">{selectedCustomer.bills.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Oldest Bill</p>
                  <p className="font-medium">{selectedCustomer.oldestBillDate.toLocaleDateString()}</p>
                </div>
              </div>

              {/* Bills List */}
              <div className="space-y-3">
                <h3 className="font-medium">Bills</h3>
                {selectedCustomer.bills.map((bill) => {
                  const billTotal = parseFloat(bill.totalAmount);
                  const billPaid = parseFloat(bill.amountPaid);
                  const billOutstanding = Math.round(billTotal - billPaid);
                  
                  return (
                    <Card key={bill.id} data-testid={`bill-card-${bill.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Receipt className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {new Date(bill.createdAt).toLocaleDateString()} - {new Date(bill.createdAt).toLocaleTimeString()}
                              </span>
                              {getPaymentStatusBadge(bill.paymentStatus)}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                              <div>
                                <span className="text-muted-foreground">Total: </span>
                                <span>Rs. {Math.round(billTotal).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Paid: </span>
                                <span>Rs. {Math.round(billPaid).toLocaleString()}</span>
                              </div>
                              {billOutstanding > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Due: </span>
                                  <span className="text-destructive font-semibold">Rs. {billOutstanding.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/bill/${bill.id}`}>
                              <Button variant="outline" size="sm" data-testid={`button-view-bill-${bill.id}`}>
                                <Printer className="h-4 w-4 mr-1" />
                                Print
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Consolidated Totals */}
              <div className="p-4 bg-muted rounded-md space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalPaid).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-base text-destructive border-t border-border pt-2">
                  <span>Total Outstanding:</span>
                  <span>Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedCustomerPhone(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setPaymentDialogOpen(true);
                    setPaymentAmount(Math.round(selectedCustomer.totalOutstanding).toString());
                  }}
                  data-testid="button-record-payment-dialog"
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Update payment for {selectedCustomer?.customerName}
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-md space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bills:</span>
                  <span className="font-mono">Rs. {Math.round(selectedCustomer.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid:</span>
                  <span className="font-mono">Rs. {Math.round(selectedCustomer.totalPaid).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Outstanding:</span>
                  <span className="font-mono">
                    Rs. {Math.round(selectedCustomer.totalOutstanding).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="1"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  data-testid="input-payment-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Payment will be applied to oldest bills first
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  disabled={recordPaymentMutation.isPending}
                  data-testid="button-submit-payment"
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product to Bill</DialogTitle>
            <DialogDescription>
              Search and select a product to add to the bill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by color code, name, company, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-colors"
                className="pl-9"
              />
            </div>

            {/* Color Selection */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredColors.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No colors found matching your search" : "Start typing to search for colors"}
                </p>
              ) : (
                filteredColors.slice(0, 20).map((color) => (
                  <Card
                    key={color.id}
                    className={`hover-elevate cursor-pointer ${selectedColor?.id === color.id ? "border-primary" : ""}`}
                    onClick={() => setSelectedColor(color)}
                    data-testid={`color-option-${color.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{color.variant.product.company}</Badge>
                            <span className="font-medium">{color.variant.product.productName}</span>
                            <Badge variant="outline">{color.variant.packingSize}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{color.colorName}</span>
                            <Badge variant="secondary">{color.colorCode}</Badge>
                            <Badge variant={color.stockQuantity > 0 ? "default" : "destructive"}>
                              Stock: {color.stockQuantity}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium">Rs. {Math.round(parseFloat(color.variant.rate))}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Quantity */}
            {selectedColor && (
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={selectedColor.stockQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
                <p className="text-xs text-muted-foreground">
                  Available stock: {selectedColor.stockQuantity} units
                </p>
                {selectedColor && (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex justify-between font-mono">
                      <span>Subtotal:</span>
                      <span>Rs. {Math.round(parseFloat(selectedColor.variant.rate) * parseInt(quantity || "0"))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAddProductDialogOpen(false);
                  setSelectedColor(null);
                  setQuantity("1");
                  setSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddProduct}
                disabled={!selectedColor || addItemMutation.isPending}
                data-testid="button-confirm-add-product"
              >
                {addItemMutation.isPending ? "Adding..." : "Add Product"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
