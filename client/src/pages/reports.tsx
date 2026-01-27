import { useState, useMemo, useDeferredValue, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useDebounce } from "@/hooks/use-debounce";

const VISIBLE_LIMIT_INITIAL = 50;
const VISIBLE_LIMIT_INCREMENT = 30;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Calendar,
  Receipt,
  CreditCard,
  Wallet,
  TrendingUp,
  TrendingDown,
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  BarChart3,
  RotateCcw,
  Percent,
  AlertTriangle,
  DollarSign,
  TrendingUp as TrendingUpIcon,
  PieChart,
  Target,
  Activity,
  Banknote,
  Clock,
  Users,
  Filter,
  Download,
  Eye,
  EyeOff,
  Edit,
  Save,
  AlertCircle,
} from "lucide-react";
import { Link } from "wouter";
import type { Sale, PaymentHistory, Return, SaleWithItems, ReturnWithItems, ColorWithVariantAndProduct } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { useDateFormat } from "@/hooks/use-date-format";

interface PaymentHistoryWithSale extends PaymentHistory {
  sale: Sale | null;
}

interface ReturnStats {
  totalReturns: number;
  totalRefunded: number;
  itemReturns: number;
  billReturns: number;
}

type SortField = "date" | "amount" | "customer";
type SortDirection = "asc" | "desc";

export default function Reports() {
  const { formatDateShort, parseDate: parseDateFromHook } = useDateFormat();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleLimit, setVisibleLimit] = useState(VISIBLE_LIMIT_INITIAL);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(true);
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);
  const [editReturnData, setEditReturnData] = useState<{ reason?: string; refundMethod?: string; totalRefund?: string; status?: string }>({});
  const [canEditReturn, setCanEditReturn] = useState<{ canEdit: boolean; hoursLeft?: number } | null>(null);
  const [editingError, setEditingError] = useState<string | null>(null);
  const [isSavingReturn, setIsSavingReturn] = useState(false);
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Helper function to get today's date in yyyy-mm-dd format (for native date input)
  const getTodayString = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Initialize with today's date in yyyy-mm-dd format (for native date input)
  useEffect(() => {
    const today = getTodayString();
    setDateFrom(today);
    setDateTo(today);
  }, [getTodayString]);

  const { data: allSalesRaw = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    staleTime: 0,
    gcTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const { data: paymentHistoryRaw = [], isLoading: historyLoading } = useQuery<PaymentHistoryWithSale[]>({
    queryKey: ["/api/payment-history"],
    staleTime: 0,
    gcTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const { data: returnsRaw = [], isLoading: returnsLoading } = useQuery<ReturnWithItems[]>({
    queryKey: ["/api/returns"],
    staleTime: 0,
    gcTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const allSales = useDeferredValue(allSalesRaw);
  const paymentHistory = useDeferredValue(paymentHistoryRaw);
  const returns = useDeferredValue(returnsRaw);

  const parseDate = useCallback((dateStr: string | Date | null): Date | null => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    if (typeof dateStr === "string" && dateStr.includes("-")) {
      const parts = dateStr.split("-");
      if (parts[0].length === 4) {
        return parseISO(dateStr);
      } else {
        const [day, month, year] = parts.map(Number);
        return new Date(year, month - 1, day);
      }
    }
    return new Date(dateStr);
  }, []);

  const formatDisplayDate = useCallback((dateStr: string | Date | null): string => {
    return formatDateShort(dateStr);
  }, [formatDateShort]);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setPaymentStatusFilter("all");
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || paymentStatusFilter !== "all";

  // NEW: Helper to check if a sale was fully returned
  const isSaleFullyReturned = useCallback((saleId: string): boolean => {
    // Check if there's a full bill return for this sale
    return returns.some(ret => 
      ret.saleId === saleId && 
      ret.returnType === "bill" && 
      ret.status === "completed"
    );
  }, [returns]);

  // NEW: Get the full bill return amount for a sale
  const getFullBillReturnAmount = useCallback((saleId: string): number => {
    const fullReturn = returns.find(ret => 
      ret.saleId === saleId && 
      ret.returnType === "bill" && 
      ret.status === "completed"
    );
    return fullReturn ? parseFloat(fullReturn.totalRefund || "0") : 0;
  }, [returns]);

  // Filter sales but exclude fully returned bills from calculations
  const filteredSales = useMemo(() => {
    let filtered = [...allSales];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (sale) =>
          sale.customerName.toLowerCase().includes(query) ||
          sale.customerPhone.includes(query)
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(parseISO(dateFrom));
      filtered = filtered.filter((sale) => {
        const saleDate = parseDate(sale.createdAt);
        return saleDate && !isBefore(saleDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(parseISO(dateTo));
      filtered = filtered.filter((sale) => {
        const saleDate = parseDate(sale.createdAt);
        return saleDate && !isAfter(saleDate, toDate);
      });
    }

    if (paymentStatusFilter !== "all") {
      filtered = filtered.filter((sale) => sale.paymentStatus === paymentStatusFilter);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          break;
        case "amount":
          comparison = parseFloat(a.totalAmount) - parseFloat(b.totalAmount);
          break;
        case "customer":
          comparison = a.customerName.localeCompare(b.customerName);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [allSales, debouncedSearchQuery, dateFrom, dateTo, paymentStatusFilter, sortField, sortDirection]);
  
  // NEW: Filter sales excluding fully returned bills for display
  const filteredSalesDisplay = useMemo(() => {
    return filteredSales.filter(sale => !isSaleFullyReturned(sale.id));
  }, [filteredSales, isSaleFullyReturned]);
  
  const visibleSales = useMemo(() => {
    return filteredSalesDisplay.slice(0, visibleLimit);
  }, [filteredSalesDisplay, visibleLimit]);

  const filteredPayments = useMemo(() => {
    let filtered = [...paymentHistory];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (payment) =>
          payment.customerPhone.includes(query) ||
          (payment.sale?.customerName?.toLowerCase().includes(query))
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(parseISO(dateFrom));
      filtered = filtered.filter((payment) => {
        const paymentDate = parseDate(payment.createdAt);
        return paymentDate && !isBefore(paymentDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(parseISO(dateTo));
      filtered = filtered.filter((payment) => {
        const paymentDate = parseDate(payment.createdAt);
        return paymentDate && !isAfter(paymentDate, toDate);
      });
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          const dateA = parseDate(a.createdAt);
          const dateB = parseDate(b.createdAt);
          comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          break;
        case "amount":
          comparison = parseFloat(a.amount) - parseFloat(b.amount);
          break;
        case "customer":
          const nameA = a.sale?.customerName || "";
          const nameB = b.sale?.customerName || "";
          comparison = nameA.localeCompare(nameB);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [paymentHistory, debouncedSearchQuery, dateFrom, dateTo, sortField, sortDirection]);
  
  const visiblePayments = useMemo(() => {
    return filteredPayments.slice(0, visibleLimit);
  }, [filteredPayments, visibleLimit]);

  const filteredReturns = useMemo(() => {
    let filtered = [...returns];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (ret) =>
          ret.customerName.toLowerCase().includes(query) ||
          ret.customerPhone.includes(query) ||
          ret.id.toLowerCase().includes(query)
      );
    }

    if (dateFrom) {
      const fromDate = startOfDay(parseISO(dateFrom));
      filtered = filtered.filter((ret) => {
        const returnDate = parseDate(ret.createdAt);
        return returnDate && !isBefore(returnDate, fromDate);
      });
    }

    if (dateTo) {
      const toDate = endOfDay(parseISO(dateTo));
      filtered = filtered.filter((ret) => {
        const returnDate = parseDate(ret.createdAt);
        return returnDate && !isAfter(returnDate, toDate);
      });
    }

    filtered.sort((a, b) => {
      const dateA = parseDate(a.createdAt);
      const dateB = parseDate(b.createdAt);
      const comparison = (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
      return sortDirection === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [returns, debouncedSearchQuery, dateFrom, dateTo, sortDirection]);
  
  const visibleReturns = useMemo(() => {
    return filteredReturns.slice(0, visibleLimit);
  }, [filteredReturns, visibleLimit]);

  // NEW: Filter unpaid sales excluding fully returned bills
  const unpaidSales = useMemo(() => {
    return filteredSalesDisplay.filter((sale) => sale.paymentStatus !== "paid");
  }, [filteredSalesDisplay]);

  // NEW: Filter paid sales excluding fully returned bills
  const paidSales = useMemo(() => {
    return filteredSalesDisplay.filter((sale) => sale.paymentStatus === "paid");
  }, [filteredSalesDisplay]);

  // NEW: Calculate totals excluding fully returned bills
  const filteredSalesTotal = useMemo(() => {
    return filteredSalesDisplay.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }, [filteredSalesDisplay]);

  const filteredSalesPaid = useMemo(() => {
    return filteredSalesDisplay.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
  }, [filteredSalesDisplay]);

  const filteredPaymentsTotal = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  }, [filteredPayments]);

  const filteredReturnsTotal = useMemo(() => {
    return filteredReturns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
  }, [filteredReturns]);

  // Returns specifically tied to filtered sales (for accurate outstanding calculation)
  const filteredSalesReturns = useMemo(() => {
    const filteredSaleIds = new Set(filteredSalesDisplay.map(s => s.id));
    return returns.filter(ret => ret.saleId && filteredSaleIds.has(ret.saleId));
  }, [filteredSalesDisplay, returns]);

  // NEW: Item returns only (full bill returns are handled separately)
  const filteredSalesItemReturns = useMemo(() => {
    return filteredSalesReturns.filter(ret => ret.returnType === "item");
  }, [filteredSalesReturns]);

  const filteredSalesItemReturnCredits = useMemo(() => {
    return filteredSalesItemReturns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
  }, [filteredSalesItemReturns]);

  // NEW: Full bill returns in the filtered range
  const filteredFullBillReturns = useMemo(() => {
    return filteredReturns.filter(ret => ret.returnType === "bill");
  }, [filteredReturns]);

  const filteredFullBillReturnCredits = useMemo(() => {
    return filteredFullBillReturns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
  }, [filteredFullBillReturns]);

  // Store Cash Balance Calculation - FIXED to handle full bill returns
  const filteredSaleIds = useMemo(() => {
    return new Set(filteredSalesDisplay.map(s => s.id));
  }, [filteredSalesDisplay]);

  // Calculate total recovery payments made for each sale in the filtered range
  const recoveryForFilteredSales = useMemo(() => {
    // Get ALL recovery payments for sales in the filtered range (not just filtered payments)
    return paymentHistory
      .filter(payment => payment.saleId && filteredSaleIds.has(payment.saleId))
      .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  }, [paymentHistory, filteredSaleIds]);

  // FIXED: Initial payments at POS for new sales (excluding fully returned bills)
  const initialPaymentsForNewSales = useMemo(() => {
    return Math.max(0, filteredSalesPaid - recoveryForFilteredSales);
  }, [filteredSalesPaid, recoveryForFilteredSales]);

  // Recovery payments received during the filter range (for any sale)
  const recoveryInRange = useMemo(() => {
    return filteredPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  }, [filteredPayments]);

  const returnStats: ReturnStats = useMemo(() => {
    return {
      totalReturns: filteredReturns.length,
      totalRefunded: filteredReturnsTotal,
      itemReturns: filteredReturns.filter((ret) => ret.returnType === "item").length,
      billReturns: filteredReturns.filter((ret) => ret.returnType === "bill").length,
    };
  }, [filteredReturns, filteredReturnsTotal]);

  const refundMethodBreakdown = useMemo(() => {
    // Separate cash refunds for full bill returns vs item returns
    const allReturns = filteredReturns;
    const cashRefundsFullBill = allReturns
      .filter(ret => ret.refundMethod === "cash" && ret.returnType === "bill")
      .reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
    
    const cashRefundsItem = allReturns
      .filter(ret => ret.refundMethod === "cash" && ret.returnType === "item")
      .reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
    
    return {
      cashRefundsFullBill,
      cashRefundsItem,
      cashRefundsTotal: cashRefundsFullBill + cashRefundsItem,
      creditRefunds: allReturns.filter((ret) => ret.refundMethod === "credit").reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0),
      bankTransferRefunds: allReturns.filter((ret) => ret.refundMethod === "bank_transfer").reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0),
      cashCount: allReturns.filter((ret) => ret.refundMethod === "cash").length,
      creditCount: allReturns.filter((ret) => ret.refundMethod === "credit").length,
      bankTransferCount: allReturns.filter((ret) => ret.refundMethod === "bank_transfer").length,
      fullBillCashCount: allReturns.filter((ret) => ret.refundMethod === "cash" && ret.returnType === "bill").length,
      itemCashCount: allReturns.filter((ret) => ret.refundMethod === "cash" && ret.returnType === "item").length,
    };
  }, [filteredReturns]);

  // Total amount refunded as credit (customer account or bank transfer)
  const creditedRefundsTotal = useMemo(() => {
    return refundMethodBreakdown.creditRefunds + refundMethodBreakdown.bankTransferRefunds;
  }, [refundMethodBreakdown.creditRefunds, refundMethodBreakdown.bankTransferRefunds]);

  // FIXED: Store Cash Balance = Initial payments at POS + Recovery in range - ONLY ITEM CASH REFUNDS
  // Full bill cash refunds are handled by NOT including those sales in New Sales calculation
  // Credit refunds don't affect cash in hand (they reduce customer balance)
  const storeCashBalance = useMemo(() => {
    // Only subtract item cash refunds (full bill refunds are already excluded from new sales)
    return initialPaymentsForNewSales + recoveryInRange - refundMethodBreakdown.cashRefundsItem;
  }, [initialPaymentsForNewSales, recoveryInRange, refundMethodBreakdown.cashRefundsItem]);

  // FIXED: Outstanding calculation - only subtract item return credits
  const filteredSalesOutstanding = useMemo(() => {
    // Outstanding = Sales Total - Paid - Item Return Credits (full bill returns excluded entirely)
    return Math.max(0, filteredSalesTotal - filteredSalesPaid - filteredSalesItemReturnCredits);
  }, [filteredSalesTotal, filteredSalesPaid, filteredSalesItemReturnCredits]);

  // NEW: Calculate totals for fully returned bills (for informational purposes)
  const fullyReturnedBillsTotal = useMemo(() => {
    const fullyReturnedBills = filteredSales.filter(sale => isSaleFullyReturned(sale.id));
    return fullyReturnedBills.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }, [filteredSales, isSaleFullyReturned]);

  const fullyReturnedBillsPaid = useMemo(() => {
    const fullyReturnedBills = filteredSales.filter(sale => isSaleFullyReturned(sale.id));
    return fullyReturnedBills.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
  }, [filteredSales, isSaleFullyReturned]);

  const unpaidSalesTotal = useMemo(() => {
    return unpaidSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
  }, [unpaidSales]);

  const unpaidSalesPaid = useMemo(() => {
    return unpaidSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
  }, [unpaidSales]);

  // Calculate item returns specifically tied to unpaid sales
  const unpaidSalesItemReturnCredits = useMemo(() => {
    const unpaidSaleIds = new Set(unpaidSales.map(s => s.id));
    return returns
      .filter(ret => ret.saleId && unpaidSaleIds.has(ret.saleId) && ret.returnType === "item")
      .reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
  }, [unpaidSales, returns]);

  // FIXED: Unpaid sales outstanding - only subtract item return credits
  const unpaidSalesOutstanding = useMemo(() => {
    return Math.max(0, unpaidSalesTotal - unpaidSalesPaid - unpaidSalesItemReturnCredits);
  }, [unpaidSalesTotal, unpaidSalesPaid, unpaidSalesItemReturnCredits]);

  const stats = useMemo(() => {
    // FIXED: Exclude fully returned bills from all calculations
    const validSales = allSales.filter(sale => !isSaleFullyReturned(sale.id));
    const totalSalesAmount = validSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount), 0);
    const totalPaidAmount = validSales.reduce((sum, sale) => sum + parseFloat(sale.amountPaid), 0);
    const totalRecoveryPayments = paymentHistory.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    // Only count item returns for calculations
    const itemReturns = returns.filter(ret => ret.returnType === "item");
    const totalReturnsAmount = itemReturns.reduce((sum, ret) => sum + parseFloat(ret.totalRefund || "0"), 0);
    const returnsCount = returns.length;
    
    // totalOutstanding properly accounts for item return credits only
    const totalOutstanding = Math.max(0, totalSalesAmount - totalPaidAmount - totalReturnsAmount);
    
    const unpaidBillsCount = validSales.filter((sale) => sale.paymentStatus !== "paid").length;
    const paidBillsCount = validSales.filter((sale) => sale.paymentStatus === "paid").length;
    const totalBillsCount = validSales.length;

    const uniqueCustomers = new Set(validSales.map((sale) => sale.customerPhone)).size;

    return {
      totalSalesAmount,
      totalPaidAmount,
      totalOutstanding,
      totalRecoveryPayments,
      totalReturnsAmount,
      returnsCount,
      unpaidBillsCount,
      paidBillsCount,
      totalBillsCount,
      totalPaymentRecords: paymentHistory.length,
      uniqueCustomers,
    };
  }, [allSales, paymentHistory, returns, isSaleFullyReturned]);

  // Total collected for filtered sales = amountPaid (already includes initial + recovery payments)
  const totalCollectedAmount = useMemo(() => {
    return filteredSalesPaid;
  }, [filteredSalesPaid]);

  const collectionRate = useMemo(() => {
    return filteredSalesTotal > 0 ? (totalCollectedAmount / filteredSalesTotal) * 100 : 0;
  }, [filteredSalesTotal, totalCollectedAmount]);

  const refundRate = useMemo(() => {
    return filteredSalesTotal > 0 ? (filteredReturnsTotal / filteredSalesTotal) * 100 : 0;
  }, [filteredSalesTotal, filteredReturnsTotal]);

  // UNIFIED TRANSACTIONS - Combines bills, payments, and returns
  type UnifiedTransaction = {
    id: string;
    date: Date;
    type: "bill" | "payment" | "return";
    description: string;
    customerName: string;
    customerPhone: string;
    debit: number; // Amount owed (bills)
    credit: number; // Amount paid/refunded (payments & returns)
    reference: string;
    billReference?: string; // For payments/returns - shows which bill
    status?: string;
    notes?: string;
    isFullBillReturn?: boolean;
  };

  const unifiedTransactions = useMemo((): UnifiedTransaction[] => {
    const transactions: UnifiedTransaction[] = [];

    // Add all bills (excluding fully returned ones)
    filteredSalesDisplay.forEach((sale) => {
      transactions.push({
        id: `bill-${sale.id}`,
        date: parseDate(sale.createdAt) || new Date(),
        type: "bill",
        description: sale.isManualBalance ? "Manual Balance" : "Sale Bill",
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        debit: parseFloat(sale.totalAmount),
        credit: 0,
        reference: sale.id.slice(0, 8).toUpperCase(),
        status: sale.paymentStatus,
        notes: sale.notes || undefined,
        isFullBillReturn: false,
      });
    });

    // Add all payments (as credits)
    filteredPayments.forEach((payment) => {
      // Try to get customer name from payment.sale, or look up from allSales by saleId
      let customerName = payment.sale?.customerName;
      if (!customerName && payment.saleId) {
        const matchingSale = allSales.find(s => s.id === payment.saleId);
        customerName = matchingSale?.customerName;
      }
      
      transactions.push({
        id: `payment-${payment.id}`,
        date: parseDate(payment.createdAt) || new Date(),
        type: "payment",
        description: `Payment (${payment.paymentMethod?.toUpperCase() || "CASH"})`,
        customerName: customerName || "Customer",
        customerPhone: payment.customerPhone,
        debit: 0,
        credit: parseFloat(payment.amount),
        reference: payment.id.slice(0, 8).toUpperCase(),
        billReference: payment.saleId ? payment.saleId.slice(0, 8).toUpperCase() : undefined,
        notes: payment.notes || undefined,
        isFullBillReturn: false,
      });
    });

    // Add all returns (as credits)
    filteredReturns.forEach((ret) => {
      const refundMethodLabel = (() => {
        switch (ret.refundMethod?.toLowerCase()) {
          case "cash":
            return "💵 Cash Refund";
          case "credit":
            return "💳 Credit Refund";
          case "bank_transfer":
            return "🏦 Bank Transfer Refund";
          default:
            return "💵 Cash Refund";
        }
      })();
      
      const returnTypeLabel = ret.returnType === "bill" ? "Full Bill Return" : "Item Return";
      
      transactions.push({
        id: `return-${ret.id}`,
        date: parseDate(ret.createdAt) || new Date(),
        type: "return",
        description: `${returnTypeLabel} (${refundMethodLabel})`,
        customerName: ret.customerName,
        customerPhone: ret.customerPhone,
        debit: 0,
        credit: parseFloat(ret.totalRefund || "0"),
        reference: `RET-${ret.id.slice(0, 6).toUpperCase()}`,
        billReference: ret.saleId ? ret.saleId.slice(0, 8).toUpperCase() : undefined,
        status: ret.status,
        notes: ret.reason || undefined,
        isFullBillReturn: ret.returnType === "bill",
      });
    });

    // Sort by date (newest first)
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

    return transactions;
  }, [filteredSalesDisplay, filteredPayments, filteredReturns, parseDate, allSales]);

  const visibleTransactions = useMemo(() => {
    return unifiedTransactions.slice(0, visibleLimit);
  }, [unifiedTransactions, visibleLimit]);

  // Transaction type badge helper
  const getTransactionTypeBadge = (type: "bill" | "payment" | "return") => {
    switch (type) {
      case "bill":
        return <Badge className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs px-2 py-0 h-5 border border-blue-200 dark:border-blue-700">Bill</Badge>;
      case "payment":
        return <Badge className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-0 h-5 border border-emerald-200 dark:border-emerald-700">Payment</Badge>;
      case "return":
        return <Badge className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs px-2 py-0 h-5 border border-rose-200 dark:border-rose-700">Return</Badge>;
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-0 h-5 border border-emerald-200 dark:border-emerald-700">Paid</Badge>;
      case "partial":
        return <Badge className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs px-2 py-0 h-5 border border-amber-200 dark:border-amber-700">Partial</Badge>;
      case "unpaid":
        return <Badge className="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-xs px-2 py-0 h-5 border border-rose-200 dark:border-rose-700">Unpaid</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0 h-5">{status}</Badge>;
    }
  };

  const getReturnTypeBadge = (type: string) => {
    switch (type) {
      case "bill":
        return <Badge className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs px-2 py-0 h-5 border border-rose-200 dark:border-rose-700">Full Bill Return</Badge>;
      case "item":
        return <Badge className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs px-2 py-0 h-5 border border-amber-200 dark:border-amber-700">Item Return</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0 h-5">{type}</Badge>;
    }
  };

  const getRefundMethodBadge = (method: string) => {
    switch (method?.toLowerCase()) {
      case "cash":
        return <Badge className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0 h-5 border border-green-200 dark:border-green-700">💵 Cash</Badge>;
      case "credit":
        return <Badge className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs px-2 py-0 h-5 border border-blue-200 dark:border-blue-700">💳 Credit</Badge>;
      case "bank_transfer":
        return <Badge className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs px-2 py-0 h-5 border border-purple-200 dark:border-purple-700">🏦 Bank Transfer</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs px-2 py-0 h-5 capitalize">{method || "cash"}</Badge>;
    }
  };

  const handleEditReturn = async (returnId: string, ret: ReturnWithItems) => {
    try {
      setEditingError(null);
      setEditingReturnId(returnId);
      
      // Check if return can be edited
      const response = await fetch(`/api/returns/${returnId}/can-edit`);
      const result = await response.json();
      setCanEditReturn(result);
      
      if (result.canEdit) {
        setEditReturnData({
          reason: ret.reason || "",
          refundMethod: ret.refundMethod || "cash",
          totalRefund: ret.totalRefund,
          status: ret.status,
        });
      } else {
        setEditingError(result.reason || "Cannot edit this return");
      }
    } catch (error) {
      setEditingError("Failed to check return edit status");
      console.error("Error checking return edit status:", error);
    }
  };

  const handleSaveReturn = async (returnId: string) => {
    try {
      setIsSavingReturn(true);
      setEditingError(null);
      
      const response = await fetch(`/api/returns/${returnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editReturnData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update return");
      }

      // Invalidate returns query to refresh data
      await fetch("/api/returns").then(() => {
        window.location.reload();
      });
      
      setEditingReturnId(null);
      setEditReturnData({});
    } catch (error) {
      setEditingError(error instanceof Error ? error.message : "Failed to update return");
      console.error("Error saving return:", error);
    } finally {
      setIsSavingReturn(false);
    }
  };

  const TableSummary = ({ tab }: { tab: string }) => {
    switch (tab) {
      case "all-sales":
        return (
          <div className="flex flex-wrap justify-between items-center p-3 bg-white/40 dark:bg-zinc-900/30 border-t border-slate-200/50 dark:border-slate-700/30">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-800 dark:text-slate-200">{filteredSalesDisplay.length}</span> bills
              {filteredFullBillReturns.length > 0 && (
                <span className="ml-2 text-rose-600 dark:text-rose-400">
                  ({filteredFullBillReturns.length} fully returned bills excluded)
                </span>
              )}
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Total:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {filteredSalesTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Paid:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {filteredSalesPaid.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Outstanding:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  {filteredSalesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      case "unpaid-bills":
        return (
          <div className="flex flex-wrap justify-between items-center p-3 bg-white/40 dark:bg-zinc-900/30 border-t border-slate-200/50 dark:border-slate-700/30">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-800 dark:text-slate-200">{unpaidSales.length}</span> unpaid bills
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Bill Total:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {unpaidSalesTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Paid:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {unpaidSalesPaid.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Outstanding:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                  {unpaidSalesOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      case "recovery-payments":
        return (
          <div className="flex flex-wrap justify-between items-center p-3 bg-white/40 dark:bg-zinc-900/30 border-t border-slate-200/50 dark:border-slate-700/30">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-800 dark:text-slate-200">{filteredPayments.length}</span> payment records
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Total Recovery:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {filteredPaymentsTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        );
      
      case "returns":
        return (
          <div className="flex flex-wrap justify-between items-center p-3 bg-white/40 dark:bg-zinc-900/30 border-t border-slate-200/50 dark:border-slate-700/30">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="text-slate-800 dark:text-slate-200">{filteredReturns.length}</span> returns
            </div>
            <div className="flex gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Total Refunded:</span>
                <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">
                  Rs. {(refundMethodBreakdown.cashRefundsTotal + refundMethodBreakdown.creditRefunds + refundMethodBreakdown.bankTransferRefunds).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="text-slate-300 dark:text-slate-600">|</div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">💵 Cash Returns:</span>
                <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
                  Rs. {refundMethodBreakdown.cashRefundsTotal.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                  <span className="text-slate-500 dark:text-slate-400 ml-1">({refundMethodBreakdown.cashCount})</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">💳 Credit:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                  Rs. {refundMethodBreakdown.creditRefunds.toLocaleString("en-IN", { minimumFractionDigits: 0 })} <span className="text-slate-500 dark:text-slate-400">({refundMethodBreakdown.creditCount})</span>
                </span>
              </div>
              {refundMethodBreakdown.bankTransferRefunds > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">🏦 Bank:</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                    Rs. {refundMethodBreakdown.bankTransferRefunds.toLocaleString("en-IN", { minimumFractionDigits: 0 })} <span className="text-slate-500 dark:text-slate-400">({refundMethodBreakdown.bankTransferCount})</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  const isLoading = salesLoading || historyLoading || returnsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
        <div className="p-6 space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white" data-testid="text-reports-title">
                Financial Reports
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Real-time financial overview and analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-slate-200 dark:border-slate-700">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
              className="border-slate-200 dark:border-slate-700"
            >
              {showDetailedMetrics ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showDetailedMetrics ? "Hide" : "Show"}
            </Button>
          </div>
        </div>

        {/* Filters Bar - Clean Design */}
        <Card className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-lg"
                    data-testid="input-search"
                  />
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/50 dark:border-slate-700/50">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-36 h-8 text-sm border-0 bg-transparent focus-visible:ring-0 p-0"
                    data-testid="input-date-from"
                  />
                  <span className="text-xs text-slate-400 font-medium">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-36 h-8 text-sm border-0 bg-transparent focus-visible:ring-0 p-0"
                    data-testid="input-date-to"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeTab !== "recovery-payments" && activeTab !== "returns" && activeTab !== "overview" && activeTab !== "transactions" && (
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger className="w-32 h-10 border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 rounded-lg" data-testid="select-payment-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {hasActiveFilters && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearFilters} 
                    data-testid="button-clear-filters"
                    className="h-10"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
            <TabsTrigger 
              value="overview" 
              data-testid="tab-overview"
              className="rounded-lg py-2 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <PieChart className="h-3.5 w-3.5 mr-1.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="transactions" 
              data-testid="tab-transactions"
              className="rounded-lg py-2 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              All
            </TabsTrigger>
            <TabsTrigger 
              value="all-sales" 
              data-testid="tab-all-sales"
              className="rounded-lg py-2 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              Bills
            </TabsTrigger>
            <TabsTrigger 
              value="recovery-payments" 
              data-testid="tab-recovery-payments"
              className="rounded-lg py-2 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              Payments
            </TabsTrigger>
            <TabsTrigger 
              value="returns" 
              data-testid="tab-returns"
              className="rounded-lg py-2 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Returns
            </TabsTrigger>
            <TabsTrigger 
              value="unpaid-bills" 
              data-testid="tab-unpaid-bills"
              className="rounded-lg py-2 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm"
            >
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Unpaid
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="space-y-5">
              {/* Summary Cards - Clean Modern Style */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Bills */}
                <Card className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Bills</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      Rs. {Math.round(filteredSalesTotal).toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      {filteredSalesDisplay.length} bills in this period
                      {fullyReturnedBillsTotal > 0 && (
                        <div className="mt-1 text-rose-500 dark:text-rose-400">
                          {filteredFullBillReturns.length} fully returned bills excluded
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Collected (Paid) */}
                <Card className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Collected</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      Rs. {Math.round(filteredSalesPaid).toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      {paidSales.length} fully paid bills
                    </div>
                  </CardContent>
                </Card>

                {/* Unpaid */}
                <Card className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                        <CreditCard className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Unpaid</span>
                    </div>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      Rs. {Math.round(filteredSalesOutstanding).toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      {unpaidSales.length} bills pending
                    </div>
                  </CardContent>
                </Card>

                {/* Returns */}
                <Card className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Item Returns</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      Rs. {Math.round(filteredSalesItemReturnCredits).toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      {filteredSalesItemReturns.length} item returns
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Cash Balance Card */}
              <Card className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/20 dark:to-zinc-900 shadow-md">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-500 rounded-xl shadow-lg">
                        <Banknote className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Cash in Hand</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {dateFrom === dateTo ? formatDisplayDate(dateFrom) : `${formatDisplayDate(dateFrom)} - ${formatDisplayDate(dateTo)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl md:text-4xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        Rs. {Math.round(storeCashBalance).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                  
                  {/* FIXED: Simple Breakdown */}
                  <div className="mt-4 pt-4 border-t border-emerald-200/50 dark:border-emerald-800/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">New Sales</div>
                        <div className="text-lg font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                          +{Math.round(initialPaymentsForNewSales).toLocaleString("en-IN")}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {filteredSalesDisplay.length} bills
                          {fullyReturnedBillsTotal > 0 && (
                            <div className="text-rose-500">({filteredFullBillReturns.length} fully returned excluded)</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Recovery</div>
                        <div className="text-lg font-semibold text-purple-600 dark:text-purple-400 tabular-nums">
                          +{Math.round(recoveryInRange).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Item Cash Refunds</div>
                        <div className="text-lg font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                          -Rs. {Math.round(refundMethodBreakdown.cashRefundsItem).toLocaleString("en-IN")}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{refundMethodBreakdown.itemCashCount} item returns</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Full Bill Cash Refunds</div>
                        <div className="text-lg font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                          -Rs. {Math.round(refundMethodBreakdown.cashRefundsFullBill).toLocaleString("en-IN")}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{refundMethodBreakdown.fullBillCashCount} full bill returns</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Note: Full bill returns are excluded from New Sales calculation. Cash in hand reflects actual cash flow.
                  </div>
                </CardContent>
              </Card>

              {/* Full Bill Returns Info Card */}
              {filteredFullBillReturns.length > 0 && (
                <Card className="rounded-xl border border-rose-200/50 dark:border-rose-800/50 bg-white dark:bg-zinc-900/50">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                          <RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">Full Bill Returns</span>
                      </div>
                      <Badge variant="secondary">{filteredFullBillReturns.length} full bill returns</Badge>
                    </div>
                    <div className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums mb-2">
                      Rs. {Math.round(fullyReturnedBillsTotal).toLocaleString("en-IN")} total bill value
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      These bills have been fully returned and are excluded from all calculations above.
                      {fullyReturnedBillsPaid > 0 && (
                        <div className="mt-1">
                          Rs. {Math.round(fullyReturnedBillsPaid).toLocaleString("en-IN")} was refunded to customers.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recovery Payments Card */}
              {filteredPayments.length > 0 && (
                <Card className="rounded-xl border border-purple-200/50 dark:border-purple-800/50 bg-white dark:bg-zinc-900/50">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                          <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">Recovery Payments</span>
                      </div>
                      <Badge variant="secondary">{filteredPayments.length} payments</Badge>
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                      Rs. {Math.round(filteredPaymentsTotal).toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Payments received on past due bills
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Collection Progress */}
              {showDetailedMetrics && (
                <Card className="rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-zinc-900/50">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">Collection Rate</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          Rs. {Math.round(totalCollectedAmount).toLocaleString("en-IN")} collected of Rs. {Math.round(filteredSalesTotal).toLocaleString("en-IN")}
                        </span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {collectionRate.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, collectionRate)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </TabsContent>

          {/* Unified Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100/50 dark:border-slate-800/30 bg-white/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">All Transactions</h3>
                    <Badge variant="outline" className="text-xs h-5 px-2 bg-white/50 dark:bg-zinc-800/50">
                      {unifiedTransactions.length} total
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="text-slate-600 dark:text-slate-400">Bills (Debit)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-600 dark:text-slate-400">Payments (Credit)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-slate-600 dark:text-slate-400">Returns (Credit)</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Date <SortIcon field="date" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Type</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Description</TableHead>
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Customer <SortIcon field="customer" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Reference</TableHead>
                      <TableHead className="py-3 text-right text-xs text-slate-600 dark:text-slate-400">Debit</TableHead>
                      <TableHead className="py-3 text-right text-xs text-slate-600 dark:text-slate-400">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTransactions.map((txn) => (
                      <TableRow 
                        key={txn.id} 
                        data-testid={`row-transaction-${txn.id}`} 
                        className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30"
                      >
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">
                          {formatDisplayDate(txn.date)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          {getTransactionTypeBadge(txn.type)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-800 dark:text-slate-200">{txn.description}</span>
                            {txn.billReference && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                Bill: #{txn.billReference}
                              </span>
                            )}
                            {txn.isFullBillReturn && (
                              <span className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                                Full Bill Return
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Link href={`/customer/${encodeURIComponent(txn.customerPhone)}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                            {txn.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          #{txn.reference}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          {txn.debit > 0 ? (
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 tabular-nums">
                              {txn.debit.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          {txn.credit > 0 ? (
                            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {txn.credit.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {unifiedTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400 py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Activity className="h-8 w-8 opacity-50" />
                            <p className="text-sm">No transactions found matching your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {unifiedTransactions.length > visibleLimit && (
                  <div className="flex justify-center py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                      data-testid="button-load-more-transactions"
                      className="text-xs h-8 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50"
                    >
                      Load More ({unifiedTransactions.length - visibleLimit} remaining)
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Transaction Summary Footer */}
              <div className="p-4 bg-slate-50/50 dark:bg-zinc-900/50 border-t border-slate-100/50 dark:border-slate-800/30">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Bills (Debit)</div>
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                      Rs. {filteredSalesTotal.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Payments (Credit)</div>
                    <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      Rs. {filteredPaymentsTotal.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Returns (Credit)</div>
                    <div className="text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      Rs. {filteredReturnsTotal.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* All Sales Tab */}
          <TabsContent value="all-sales">
            <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Customer <SortIcon field="customer" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Phone</TableHead>
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Amount <SortIcon field="amount" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Paid</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Outstanding</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Status</TableHead>
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Date <SortIcon field="date" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`} className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30">
                        <TableCell className="py-2.5">
                          <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                            {sale.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{sale.customerPhone}</TableCell>
                        <TableCell className="py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                          {parseFloat(sale.totalAmount).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                          {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5">{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{formatDisplayDate(sale.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredSalesDisplay.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400 py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Receipt className="h-8 w-8 opacity-50" />
                            <p className="text-sm">No sales found matching your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {filteredSalesDisplay.length > visibleLimit && (
                  <div className="flex justify-center py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                      data-testid="button-load-more-sales-reports"
                      className="text-xs h-8 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50"
                    >
                      Load More ({filteredSalesDisplay.length - visibleLimit} remaining)
                    </Button>
                  </div>
                )}
              </div>
              <TableSummary tab="all-sales" />
            </Card>
          </TabsContent>

          {/* Unpaid Bills Tab */}
          <TabsContent value="unpaid-bills">
            <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Customer <SortIcon field="customer" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Phone</TableHead>
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Bill Amount <SortIcon field="amount" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Paid</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Outstanding</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Status</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Due Date</TableHead>
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Bill Date <SortIcon field="date" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-unpaid-${sale.id}`} className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30">
                        <TableCell className="py-2.5">
                          <Link href={`/customer/${encodeURIComponent(sale.customerPhone)}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                            {sale.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{sale.customerPhone}</TableCell>
                        <TableCell className="py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                          {parseFloat(sale.totalAmount).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {parseFloat(sale.amountPaid).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-rose-600 dark:text-rose-400 font-medium tabular-nums">
                          {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5">{getPaymentStatusBadge(sale.paymentStatus)}</TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{sale.dueDate ? formatDisplayDate(sale.dueDate) : "Not set"}</TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{formatDisplayDate(sale.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {unpaidSales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-8">
                          <div className="flex flex-col items-center gap-2">
                            <CreditCard className="h-8 w-8 opacity-50" />
                            <p className="text-sm">No unpaid bills found matching your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <TableSummary tab="unpaid-bills" />
            </Card>
          </TabsContent>

          {/* Recovery Payments Tab */}
          <TabsContent value="recovery-payments">
            <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("customer")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Customer <SortIcon field="customer" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Phone</TableHead>
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("amount")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Payment <SortIcon field="amount" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Prev Balance</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">New Balance</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Method</TableHead>
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Date <SortIcon field="date" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePayments.map((payment) => (
                      <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`} className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30">
                        <TableCell className="py-2.5">
                          <Link href={`/customer/${encodeURIComponent(payment.customerPhone)}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                            {payment.sale?.customerName || "Unknown"}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{payment.customerPhone}</TableCell>
                        <TableCell className="py-2.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                          {parseFloat(payment.amount).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {parseFloat(payment.previousBalance).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                          {parseFloat(payment.newBalance).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge className="text-xs px-1.5 py-0 h-5 bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-0 capitalize">
                            {payment.paymentMethod || "cash"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{formatDisplayDate(payment.createdAt)}</TableCell>
                        <TableCell className="py-2.5 max-w-[150px] truncate text-xs text-slate-500 dark:text-slate-400">
                          {payment.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPayments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Wallet className="h-8 w-8 opacity-50" />
                            <p className="text-sm">No recovery payments found matching your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {filteredPayments.length > visibleLimit && (
                  <div className="flex justify-center py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                      data-testid="button-load-more-payments-reports"
                      className="text-xs h-8 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50"
                    >
                      Load More ({filteredPayments.length - visibleLimit} remaining)
                    </Button>
                  </div>
                )}
              </div>
              <TableSummary tab="recovery-payments" />
            </Card>
          </TabsContent>

          {/* Returns Tab */}
          <TabsContent value="returns">
            <Card className="rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/50 dark:bg-zinc-900/50">
                      <TableHead className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => toggleSort("date")} className="flex items-center text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                          Date <SortIcon field="date" />
                        </Button>
                      </TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Return ID</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Customer</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Phone</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Return Method</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Refund Method</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Reason</TableHead>
                      <TableHead className="py-3 text-right text-xs text-slate-600 dark:text-slate-400">Refund Amount</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Items</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Status</TableHead>
                      <TableHead className="py-3 text-xs text-slate-600 dark:text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleReturns.map((ret) => (
                      <TableRow key={ret.id} data-testid={`row-return-${ret.id}`} className="hover:bg-white/30 dark:hover:bg-zinc-900/30 border-b border-slate-100/50 dark:border-slate-800/30">
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{formatDisplayDate(ret.createdAt)}</TableCell>
                        <TableCell className="py-2.5 font-mono text-xs font-medium">#{ret.id.slice(0, 6).toUpperCase()}</TableCell>
                        <TableCell className="py-2.5 text-sm font-medium">{ret.customerName}</TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400">{ret.customerPhone}</TableCell>
                        <TableCell className="py-2.5">{getReturnTypeBadge(ret.returnType)}</TableCell>
                        <TableCell className="py-2.5">{getRefundMethodBadge(ret.refundMethod)}</TableCell>
                        <TableCell className="py-2.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate" title={ret.reason || "No reason provided"}>
                          {ret.reason || <span className="text-slate-400 italic">No reason</span>}
                        </TableCell>
                        <TableCell className="py-2.5 text-right text-sm font-medium text-rose-600 dark:text-rose-400 tabular-nums">
                          Rs. {parseFloat(ret.totalRefund || "0").toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-slate-50/70 dark:bg-slate-800/70">
                            {ret.returnItems.length} items
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant={ret.status === "completed" ? "default" : "secondary"} className="text-xs px-1.5 py-0 h-5 capitalize">
                            {ret.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditReturn(ret.id, ret)}
                            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredReturns.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-8">
                          <div className="flex flex-col items-center gap-2">
                            <RotateCcw className="h-8 w-8 opacity-50" />
                            <p className="text-sm">No returns found matching your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {filteredReturns.length > visibleLimit && (
                  <div className="flex justify-center py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisibleLimit(prev => prev + VISIBLE_LIMIT_INCREMENT)}
                      data-testid="button-load-more-returns-reports"
                      className="text-xs h-8 border-slate-200/70 dark:border-slate-700/50 bg-white/60 dark:bg-zinc-900/50"
                    >
                      Load More ({filteredReturns.length - visibleLimit} remaining)
                    </Button>
                  </div>
                )}
              </div>
              <TableSummary tab="returns" />
            </Card>

            {/* Edit Return Modal */}
            {editingReturnId && (
              <Card className="rounded-xl border border-blue-200/50 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/10 backdrop-blur-sm overflow-hidden shadow-sm mt-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">Edit Return</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingReturnId(null);
                        setEditReturnData({});
                        setEditingError(null);
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {!canEditReturn?.canEdit && editingError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-red-700 dark:text-red-300 font-medium">{editingError}</p>
                        {canEditReturn?.hoursLeft !== undefined && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            This return can only be edited within 12 hours of creation.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {canEditReturn?.canEdit && (
                    <div className="space-y-4">
                      {canEditReturn.hoursLeft !== undefined && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
                          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                              Edit window: {canEditReturn.hoursLeft.toFixed(1)} hours remaining
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                            Refund Method
                          </label>
                          <Select
                            value={editReturnData.refundMethod || "cash"}
                            onValueChange={(value) =>
                              setEditReturnData({ ...editReturnData, refundMethod: value })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">💵 Cash</SelectItem>
                              <SelectItem value="credit">💳 Credit</SelectItem>
                              <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                            Status
                          </label>
                          <Select
                            value={editReturnData.status || "completed"}
                            onValueChange={(value) =>
                              setEditReturnData({ ...editReturnData, status: value })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs border-slate-200 dark:border-slate-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                            Refund Amount
                          </label>
                          <Input
                            type="number"
                            value={editReturnData.totalRefund || ""}
                            onChange={(e) =>
                              setEditReturnData({ ...editReturnData, totalRefund: e.target.value })
                            }
                            placeholder="0.00"
                            className="h-8 text-xs border-slate-200 dark:border-slate-700"
                            step="0.01"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                            Reason
                          </label>
                          <Input
                            value={editReturnData.reason || ""}
                            onChange={(e) =>
                              setEditReturnData({ ...editReturnData, reason: e.target.value })
                            }
                            placeholder="Enter reason for return"
                            className="h-8 text-xs border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      </div>

                      {editingError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-700 dark:text-red-300">{editingError}</p>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingReturnId(null);
                            setEditReturnData({});
                            setEditingError(null);
                          }}
                          className="h-8 text-xs border-slate-200 dark:border-slate-700"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveReturn(editingReturnId)}
                          disabled={isSavingReturn}
                          className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Save className="h-3.5 w-3.5 mr-1" />
                          {isSavingReturn ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
