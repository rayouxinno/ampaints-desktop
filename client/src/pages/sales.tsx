import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

interface Sale {
  id: string;
  customerName: string;
  customerPhone: string;
  totalAmount: string;
  amountPaid: string;
  paymentStatus: string;
  createdAt: string;
}

export default function Sales() {
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const filteredSales = useMemo(() => {
    const query = customerSearchQuery.toLowerCase().trim();
    if (!query) return sales;

    return sales.filter((sale) => {
      const customerName = sale.customerName.toLowerCase();
      const customerPhone = sale.customerPhone.toLowerCase();
      return customerName.includes(query) || customerPhone.includes(query);
    });
  }, [sales, customerSearchQuery]);

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-sales-title">Sales</h1>
        <p className="text-sm text-muted-foreground">View all sales transactions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name or phone..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-sales-search"
                />
              </div>

              {filteredSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {customerSearchQuery ? "No sales found matching your search." : "No sales yet."}
                </div>
              ) : (
                <>
                  <div className="grid gap-3">
                    {filteredSales.map((sale) => {
                      const totalFloat = parseFloat(sale.totalAmount);
                      const paidFloat = parseFloat(sale.amountPaid);
                      const totalAmount = Math.round(totalFloat);
                      const amountPaid = Math.round(paidFloat);
                      const amountDue = Math.round(totalFloat - paidFloat);

                      return (
                        <Card key={sale.id} className="hover-elevate" data-testid={`card-sale-${sale.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Receipt className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-semibold">{sale.customerName}</span>
                                  {getPaymentStatusBadge(sale.paymentStatus)}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Phone: </span>
                                    <span className="font-mono">{sale.customerPhone}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Date: </span>
                                    <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Time: </span>
                                    <span>{new Date(sale.createdAt).toLocaleTimeString()}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-mono">
                                  <div>
                                    <span className="text-muted-foreground">Total: </span>
                                    <span className="font-semibold">Rs. {totalAmount.toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Paid: </span>
                                    <span className="font-semibold">Rs. {amountPaid.toLocaleString()}</span>
                                  </div>
                                  {amountDue > 0 && (
                                    <div>
                                      <span className="text-muted-foreground">Due: </span>
                                      <span className="font-semibold text-destructive">Rs. {amountDue.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Link
                                href={`/bill/${sale.id}`}
                                className="text-sm text-primary hover:underline whitespace-nowrap"
                                data-testid={`link-view-bill-${sale.id}`}
                              >
                                View Bill
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {customerSearchQuery && filteredSales.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing {filteredSales.length} of {sales.length} sales
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
