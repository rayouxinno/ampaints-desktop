import { useState, useMemo, useRef } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, Calendar, User, Phone, Plus, Trash2, Eye, Search, Banknote, Printer, Receipt, Filter, FileText, Download } from "lucide-react";
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
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<string>("all");
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);

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

  // FILTERED CUSTOMERS WITH ALL FILTERS
  const filteredCustomers = useMemo(() => {
    return consolidatedCustomers.filter(customer => {
      // Search filter
      const matchesSearch = 
        customer.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.customerPhone.includes(searchQuery);
      
      // Status filter
      let matchesStatus = true;
      if (statusFilter === "overdue") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchesStatus = customer.oldestBillDate < thirtyDaysAgo;
      } else if (statusFilter === "recent") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        matchesStatus = customer.oldestBillDate >= sevenDaysAgo;
      }

      // Date filter
      let matchesDate = true;
      if (dateFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = customer.oldestBillDate >= weekAgo;
      } else if (dateFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        matchesDate = customer.oldestBillDate >= monthAgo;
      }

      // Amount filter
      let matchesAmount = true;
      if (amountFilter === "small") {
        matchesAmount = customer.totalOutstanding <= 1000;
      } else if (amountFilter === "medium") {
        matchesAmount = customer.totalOutstanding > 1000 && customer.totalOutstanding <= 5000;
      } else if (amountFilter === "large") {
        matchesAmount = customer.totalOutstanding > 5000;
      }

      return matchesSearch && matchesStatus && matchesDate && matchesAmount;
    });
  }, [consolidatedCustomers, searchQuery, statusFilter, dateFilter, amountFilter]);

  // REPORT STATISTICS
  const reportStats = useMemo(() => {
    const totalCustomers = filteredCustomers.length;
    const totalBills = filteredCustomers.reduce((sum, customer) => sum + customer.bills.length, 0);
    const totalOutstanding = filteredCustomers.reduce((sum, customer) => sum + customer.totalOutstanding, 0);
    const totalAmount = filteredCustomers.reduce((sum, customer) => sum + customer.totalAmount, 0);
    const totalPaid = filteredCustomers.reduce((sum, customer) => sum + customer.totalPaid, 0);

    return {
      totalCustomers,
      totalBills,
      totalOutstanding: Math.round(totalOutstanding),
      totalAmount: Math.round(totalAmount),
      totalPaid: Math.round(totalPaid),
      averagePerCustomer: totalCustomers > 0 ? Math.round(totalOutstanding / totalCustomers) : 0
    };
  }, [filteredCustomers]);

  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const selectedCustomer = consolidatedCustomers.find(c => c.customerPhone === selectedCustomerPhone);

  // PRINT REPORT FUNCTION
  const printReport = () => {
    if (reportRef.current) {
      const printContent = reportRef.current.innerHTML;
      const originalContent = document.body.innerHTML;
      
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-unpaid-bills-title">
            Unpaid Bills
          </h1>
          <p className="text-sm text-muted-foreground">Track and manage outstanding payments</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setReportDialogOpen(true)}
          >
            <FileText className="h-4 w-4" />
            Report
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* FILTERS SECTION */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-customers"
              className="pl-9"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="overdue">Overdue (30+ days)</SelectItem>
                  <SelectItem value="recent">Recent (7 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger data-testid="select-date-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Amount Range</label>
              <Select value={amountFilter} onValueChange={setAmountFilter}>
                <SelectTrigger data-testid="select-amount-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Amounts</SelectItem>
                  <SelectItem value="small">Small (&lt; 1K)</SelectItem>
                  <SelectItem value="medium">Medium (1K-5K)</SelectItem>
                  <SelectItem value="large">Large (&gt; 5K)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Count and Clear Filters */}
          {(searchQuery || statusFilter !== "all" || dateFilter !== "all" || amountFilter !== "all") && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                Showing {filteredCustomers.length} of {consolidatedCustomers.length} customers
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setDateFilter("all");
                  setAmountFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
      ) : filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">
              {consolidatedCustomers.length === 0 ? "No unpaid bills" : "No results found"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {consolidatedCustomers.length === 0 
                ? "All payments are up to date"
                : "Try adjusting your filters"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => {
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

      {/* REPORT DIALOG */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Unpaid Bills Report</DialogTitle>
            <DialogDescription>
              Complete overview of all outstanding payments
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Report Actions */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">
                  Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={printReport} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Print Report
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>

            {/* Printable Report Content */}
            <div ref={reportRef} className="print:block space-y-6">
              {/* Report Header */}
              <div className="text-center border-b pb-4 print:border-b-2 print:border-gray-800">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                    <span className="text-xl font-bold text-primary-foreground">AMP</span>
                  </div>
                  <h1 className="text-2xl font-bold">A.M Paints</h1>
                </div>
                <p className="text-sm text-muted-foreground">Dunyapur Road, Basti Malook (Multan). 03008683395</p>
                <h2 className="text-xl font-semibold mt-4">Unpaid Bills Report</h2>
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString()} - {filteredCustomers.length} Customers
                </p>
              </div>

              {/* Summary Statistics */}
              <Card className="print:shadow-none print:border-2">
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="space-y-2 p-4 border rounded-lg">
                      <h3 className="font-semibold text-sm">Total Customers</h3>
                      <p className="text-2xl font-bold text-blue-600">{reportStats.totalCustomers}</p>
                    </div>
                    <div className="space-y-2 p-4 border rounded-lg">
                      <h3 className="font-semibold text-sm">Total Bills</h3>
                      <p className="text-2xl font-bold text-green-600">{reportStats.totalBills}</p>
                    </div>
                    <div className="space-y-2 p-4 border rounded-lg">
                      <h3 className="font-semibold text-sm">Total Outstanding</h3>
                      <p className="text-2xl font-bold text-red-600">Rs. {reportStats.totalOutstanding.toLocaleString()}</p>
                    </div>
                    <div className="space-y-2 p-4 border rounded-lg">
                      <h3 className="font-semibold text-sm">Avg per Customer</h3>
                      <p className="text-2xl font-bold text-purple-600">Rs. {reportStats.averagePerCustomer.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Customer List */}
              <Card className="print:shadow-none print:border-2">
                <CardHeader>
                  <CardTitle className="text-lg">Customer Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Bills</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Oldest Bill</TableHead>
                        <TableHead>Days Overdue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => {
                        const daysOverdue = getDaysOverdue(customer.oldestBillDate);
                        return (
                          <TableRow key={customer.customerPhone}>
                            <TableCell className="font-medium">{customer.customerName}</TableCell>
                            <TableCell>{customer.customerPhone}</TableCell>
                            <TableCell>{customer.bills.length}</TableCell>
                            <TableCell className="font-mono">Rs. {Math.round(customer.totalAmount).toLocaleString()}</TableCell>
                            <TableCell className="font-mono">Rs. {Math.round(customer.totalPaid).toLocaleString()}</TableCell>
                            <TableCell className="font-mono font-semibold text-red-600">
                              Rs. {Math.round(customer.totalOutstanding).toLocaleString()}
                            </TableCell>
                            <TableCell>{customer.oldestBillDate.toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={daysOverdue > 30 ? "destructive" : "secondary"}>
                                {daysOverdue} days
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Bill Breakdown */}
              <Card className="print:shadow-none print:border-2">
                <CardHeader>
                  <CardTitle className="text-lg">Bill Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredCustomers.map((customer) => (
                      <div key={customer.customerPhone} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{customer.customerName}</h4>
                            <p className="text-sm text-muted-foreground">{customer.customerPhone}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-semibold text-red-600">
                              Rs. {Math.round(customer.totalOutstanding).toLocaleString()}
                            </p>
                            <p className="text-sm text-muted-foreground">{customer.bills.length} bills</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {customer.bills.map((bill) => {
                            const billTotal = parseFloat(bill.totalAmount);
                            const billPaid = parseFloat(bill.amountPaid);
                            const billOutstanding = billTotal - billPaid;
                            return (
                              <div key={bill.id} className="flex justify-between items-center text-sm border-l-4 border-blue-500 pl-3 py-1">
                                <div>
                                  <span className="font-medium">Bill #{bill.id.slice(-6)}</span>
                                  <span className="text-muted-foreground ml-2">
                                    {new Date(bill.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex gap-4">
                                  <span className="font-mono">Total: Rs. {Math.round(billTotal).toLocaleString()}</span>
                                  <span className="font-mono">Paid: Rs. {Math.round(billPaid).toLocaleString()}</span>
                                  <span className="font-mono font-semibold text-red-600">
                                    Due: Rs. {Math.round(billOutstanding).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Report Footer */}
              <div className="text-center border-t pt-4 print:border-t-2 print:border-gray-800">
                <p className="text-sm text-muted-foreground">
                  This report was generated automatically by A.M Paints Management System
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  For any queries, please contact: 03008683395
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* REST OF THE DIALOGS (Customer Bills, Payment, Add Product) remain the same */}
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
                               
