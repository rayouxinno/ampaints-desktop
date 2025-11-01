// unpaid-bills.tsx
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
import { 
  CreditCard, 
  Calendar, 
  User, 
  Phone, 
  Plus, 
  Trash2, 
  Eye, 
  Search, 
  Banknote, 
  Printer, 
  Receipt,
  Filter,
  Edit,
  RotateCcw,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Sale, SaleWithItems, ColorWithVariantAndProduct, SaleItem } from "@shared/schema";
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
  const [editBillDialogOpen, setEditBillDialogOpen] = useState(false);
  const [returnItemDialogOpen, setReturnItemDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<string>("all");
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [itemToReturn, setItemToReturn] = useState<SaleItem | null>(null);
  const [returnQuantity, setReturnQuantity] = useState("1");
  const { toast } = useToast();

  // Safe queries with default empty arrays
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

  const returnItemMutation = useMutation({
    mutationFn: async (data: { saleItemId: string; quantity: number; reason: string }) => {
      return await apiRequest("POST", `/api/sale-items/${data.saleItemId}/return`, {
        quantity: data.quantity,
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      if (selectedSaleId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sales/${selectedSaleId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Item returned successfully" });
      setReturnItemDialogOpen(false);
      setItemToReturn(null);
      setReturnQuantity("1");
    },
    onError: () => {
      toast({ title: "Failed to return item", variant: "destructive" });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (saleId: string) => {
      return await apiRequest("DELETE", `/api/sales/${saleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Bill deleted successfully" });
      setSelectedSaleId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete bill", variant: "destructive" });
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

    if (amount > selectedCustomer.totalOutstanding) {
      toast({ 
        title: `Payment amount (Rs. ${Math.round(amount).toLocaleString()}) exceeds outstanding balance (Rs. ${Math.round(selectedCustomer.totalOutstanding).toLocaleString()})`, 
        variant: "destructive" 
      });
      return;
    }

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
      
      const paymentForThisBill = Math.min(remainingPayment, billOutstanding);
      if (paymentForThisBill > 0) {
        paymentsToApply.push({ saleId: bill.id, amount: paymentForThisBill });
        remainingPayment -= paymentForThisBill;
      }
    }

    for (const payment of paymentsToApply) {
      await recordPaymentMutation.mutateAsync(payment);
    }
  };

  const handleAddProduct = async () => {
    if (!selectedSaleId || !selectedColor) {
      toast({ title: "Please select a product", variant: "destructive" });
      return;
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      toast({ title: "Quantity must be positive", variant: "destructive" });
      return;
    }

    if (qty > selectedColor.stockQuantity) {
      toast({ 
        title: "Insufficient stock", 
        description: `Only ${selectedColor.stockQuantity} units available`,
        variant: "destructive" 
      });
      return;
    }

    const rate = parseFloat(selectedColor.variant.rate);
    const subtotal = qty * rate;

    await addItemMutation.mutateAsync({
      saleId: selectedSaleId,
      colorId: selectedColor.id,
      quantity: qty,
      rate,
      subtotal,
    });
  };

  const handleReturnItem = async () => {
    if (!itemToReturn || !returnQuantity) {
      toast({ title: "Please select quantity to return", variant: "destructive" });
      return;
    }

    const qty = parseInt(returnQuantity);
    if (qty <= 0) {
      toast({ title: "Quantity must be positive", variant: "destructive" });
      return;
    }

    if (qty > itemToReturn.quantity) {
      toast({ 
        title: "Cannot return more than purchased", 
        description: `Only ${itemToReturn.quantity} units purchased`,
        variant: "destructive" 
      });
      return;
    }

    await returnItemMutation.mutateAsync({
      saleItemId: itemToReturn.id,
      quantity: qty,
      reason: "Customer return",
    });
  };

  const consolidatedCustomers = useMemo(() => {
    const customerMap = new Map<string, ConsolidatedCustomer>();
    
    (unpaidSales || []).forEach(sale => {
      const existing = customerMap.get(sale.customerPhone);
      const saleTotal = parseFloat(sale.totalAmount || "0");
      const salePaid = parseFloat(sale.amountPaid || "0");
      const saleOutstanding = saleTotal - salePaid;
      
      if (existing) {
        existing.bills.push(sale);
        existing.totalAmount += saleTotal;
        existing.totalPaid += salePaid;
        existing.totalOutstanding += saleOutstanding;
        if (new Date(sale.createdAt) < existing.oldestBillDate) {
          existing.oldestBillDate = new Date(sale.createdAt);
        }
      } else {
        customerMap.set(sale.customerPhone, {
          customerPhone: sale.customerPhone || "",
          customerName: sale.customerName || "Unknown Customer",
          bills: [sale],
          totalAmount: saleTotal,
          totalPaid: salePaid,
          totalOutstanding: saleOutstanding,
          oldestBillDate: new Date(sale.createdAt),
        });
      }
    });

    return Array.from(customerMap.values());
  }, [unpaidSales]);

  const filteredCustomers = useMemo(() => {
    return (consolidatedCustomers || []).filter(customer => {
      if (!customer) return false;
      
      // Search filter
      const matchesSearch = 
        (customer.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.customerPhone || "").includes(searchQuery);
      
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

  const selectedCustomer = useMemo(() => {
    if (!selectedSaleId) return null;
    return (consolidatedCustomers || []).find(c => 
      c && c.bills && c.bills.some(b => b.id === selectedSaleId)
    );
  }, [consolidatedCustomers, selectedSaleId]);

  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors || [];
    const q = searchQuery.toLowerCase().trim();
    return (colors || []).filter(
      (c) =>
        c?.colorCode?.toLowerCase().includes(q) ||
        c?.colorName?.toLowerCase().includes(q) ||
        c?.variant?.product?.productName?.toLowerCase().includes(q) ||
        c?.variant?.product?.company?.toLowerCase().includes(q)
    );
  }, [colors, searchQuery]);

  const PaymentStatusBadge = ({ sale }: { sale: Sale }) => {
    const total = parseFloat(sale.totalAmount || "0");
    const paid = parseFloat(sale.amountPaid || "0");
    const outstanding = total - paid;

    if (outstanding === 0) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
    } else if (paid === 0) {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Unpaid</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Partial</Badge>;
    }
  };

  const StockQuantity = ({ stock }: { stock: number }) => {
    if (stock <= 0) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
          Out of Stock
        </Badge>
      );
    } else if (stock <= 10) {
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
          Low: {stock}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
          {stock}
        </Badge>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Unpaid Bills</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage customer outstanding payments and bill modifications
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="overdue">Overdue (30+ days)</SelectItem>
                  <SelectItem value="recent">Recent (7 days)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>

              <Select value={amountFilter} onValueChange={setAmountFilter}>
                <SelectTrigger>
                  <Banknote className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Amount" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Amounts</SelectItem>
                  <SelectItem value="small">Small (&lt; 1K)</SelectItem>
                  <SelectItem value="medium">Medium (1K-5K)</SelectItem>
                  <SelectItem value="large">Large (&gt; 5K)</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-gray-500 flex items-center justify-end">
                {(filteredCustomers || []).length} customers found
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Cards */}
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </Card>
              ))
            ) : (filteredCustomers || []).length === 0 ? (
              <Card className="p-8 text-center">
                <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No unpaid bills found</h3>
                <p className="text-gray-500">All customer bills are paid up to date.</p>
              </Card>
            ) : (
              (filteredCustomers || []).map((customer) => (
                customer && (
                  <Card key={customer.customerPhone} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-500" />
                              <h3 className="font-semibold text-gray-900">{customer.customerName || "Unknown Customer"}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">{customer.customerPhone || "No Phone"}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                            <div>
                              <div className="font-medium">Total Bills</div>
                              <div>{(customer.bills || []).length}</div>
                            </div>
                            <div>
                              <div className="font-medium">Total Amount</div>
                              <div>Rs. {Math.round(customer.totalAmount || 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="font-medium">Outstanding</div>
                              <div className="font-bold text-red-600">
                                Rs. {Math.round(customer.totalOutstanding || 0).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(customer.bills || []).map((bill) => (
                              bill && (
                                <Badge
                                  key={bill.id}
                                  variant="outline"
                                  className={`cursor-pointer hover:bg-gray-50 ${
                                    selectedSaleId === bill.id ? "bg-blue-50 border-blue-200" : ""
                                  }`}
                                  onClick={() => setSelectedSaleId(bill.id)}
                                >
                                  Bill #{bill.id?.slice(-6) || "N/A"}
                                  <PaymentStatusBadge sale={bill} />
                                </Badge>
                              )
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (customer.bills && customer.bills.length > 0) {
                                setSelectedSaleId(customer.bills[0].id);
                                setPaymentDialogOpen(true);
                              }
                            }}
                            className="gap-2"
                            disabled={!customer.bills || customer.bills.length === 0}
                          >
                            <Banknote className="h-4 w-4" />
                            Pay
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (customer.bills && customer.bills.length > 0) {
                                setSelectedSaleId(customer.bills[0].id);
                              }
                            }}
                            className="gap-2"
                            disabled={!customer.bills || customer.bills.length === 0}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              ))
            )}
          </div>

          {/* Bill Details */}
          <div className="space-y-6">
            {selectedSaleId && saleDetails ? (
              <Card className="sticky top-6">
                <CardHeader className="bg-gray-50 border-b">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Bill Details</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditBillDialogOpen(true)}
                        className="gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Link href={`/bill/${selectedSaleId}`}>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Receipt className="h-4 w-4" />
                          Print
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-4 border-b">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold">{saleDetails.customerName || "Unknown Customer"}</div>
                        <div className="text-sm text-gray-500">{saleDetails.customerPhone || "No Phone"}</div>
                      </div>
                      <PaymentStatusBadge sale={saleDetails} />
                    </div>
                    <div className="text-sm text-gray-600">
                      Bill Date: {saleDetails.createdAt ? new Date(saleDetails.createdAt).toLocaleDateString() : "Unknown Date"}
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(saleDetails.items || []).map((item) => (
                          item && (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="text-sm font-medium">
                                  {item.color?.variant?.product?.productName || "Unknown Product"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {item.color?.colorName || "Unknown Color"} ({item.color?.colorCode || "N/A"})
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{item.quantity || 0}</TableCell>
                              <TableCell className="text-right">Rs. {Math.round(parseFloat(item.rate || "0"))}</TableCell>
                              <TableCell className="text-right">Rs. {Math.round(parseFloat(item.subtotal || "0"))}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-red-500"
                                    onClick={() => deleteItemMutation.mutate(item.id)}
                                    disabled={deleteItemMutation.isLoading}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-blue-500"
                                    onClick={() => {
                                      setItemToReturn(item);
                                      setReturnQuantity("1");
                                      setReturnItemDialogOpen(true);
                                    }}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="p-4 border-t bg-gray-50">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>Rs. {Math.round(parseFloat(saleDetails.totalAmount || "0"))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Paid:</span>
                        <span>Rs. {Math.round(parseFloat(saleDetails.amountPaid || "0"))}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Outstanding:</span>
                        <span className="text-red-600">
                          Rs. {Math.round(parseFloat(saleDetails.totalAmount || "0") - parseFloat(saleDetails.amountPaid || "0"))}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setPaymentAmount(
                            (parseFloat(saleDetails.totalAmount || "0") - parseFloat(saleDetails.amountPaid || "0")).toString()
                          );
                          setPaymentDialogOpen(true);
                        }}
                      >
                        Record Payment
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => deleteSaleMutation.mutate(selectedSaleId)}
                        disabled={deleteSaleMutation.isLoading}
                      >
                        Delete Bill
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bill selected</h3>
                <p className="text-gray-500">Select a bill from the list to view details</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record payment for {selectedCustomer?.customerName || "selected customer"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Amount</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            {selectedCustomer && (
              <div className="text-sm text-gray-600">
                Outstanding Balance: Rs. {Math.round(selectedCustomer.totalOutstanding || 0).toLocaleString()}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleRecordPayment}
                disabled={recordPaymentMutation.isLoading}
              >
                Record Payment
              </Button>
              <Button
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Product to Bill</DialogTitle>
            <DialogDescription>
              Search and add products to the current bill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search Products</Label>
              <Input
                placeholder="Search by code, name, product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredColors || []).map((color) => (
                    color && (
                      <TableRow key={color.id}>
                        <TableCell>
                          <div className="font-medium">
                            {color.variant?.product?.productName || "Unknown Product"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {color.colorName || "Unknown Color"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{color.colorCode || "N/A"}</Badge>
                        </TableCell>
                        <TableCell>
                          <StockQuantity stock={color.stockQuantity || 0} />
                        </TableCell>
                        <TableCell>Rs. {Math.round(parseFloat(color.variant?.rate || "0"))}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => setSelectedColor(color)}
                            disabled={(color.stockQuantity || 0) <= 0}
                          >
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  ))}
                </TableBody>
              </Table>
            </div>

            {selectedColor && (
              <div className="space-y-3 p-4 border rounded-md bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{selectedColor.variant?.product?.productName || "Unknown Product"}</div>
                    <div className="text-sm text-gray-500">
                      {selectedColor.colorName || "Unknown Color"} ({selectedColor.colorCode || "N/A"})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">Rs. {Math.round(parseFloat(selectedColor.variant?.rate || "0"))}</div>
                    <div className="text-sm text-gray-500">
                      Stock: {selectedColor.stockQuantity || 0}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                      max={selectedColor.stockQuantity || 0}
                    />
                  </div>
                  <Button
                    onClick={handleAddProduct}
                    disabled={addItemMutation.isLoading}
                    className="mt-6"
                  >
                    Add to Bill
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Item Dialog */}
      <Dialog open={returnItemDialogOpen} onOpenChange={setReturnItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Item</DialogTitle>
            <DialogDescription>
              Process return for selected item
            </DialogDescription>
          </DialogHeader>
          {itemToReturn && (
            <div className="space-y-4">
              <div>
                <div className="font-medium">{itemToReturn.color?.variant?.product?.productName || "Unknown Product"}</div>
                <div className="text-sm text-gray-500">
                  {itemToReturn.color?.colorName || "Unknown Color"} ({itemToReturn.color?.colorCode || "N/A"})
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Purchased Qty</div>
                  <div className="font-medium">{itemToReturn.quantity || 0}</div>
                </div>
                <div>
                  <div className="text-gray-500">Rate</div>
                  <div className="font-medium">Rs. {Math.round(parseFloat(itemToReturn.rate || "0"))}</div>
                </div>
              </div>
              <div>
                <Label>Quantity to Return</Label>
                <Input
                  type="number"
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(e.target.value)}
                  min="1"
                  max={itemToReturn.quantity || 0}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleReturnItem}
                  disabled={returnItemMutation.isLoading}
                >
                  Process Return
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReturnItemDialogOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
