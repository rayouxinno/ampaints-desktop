import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { SaleWithItems } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function BillPrint() {
  const [, params] = useRoute("/bill/:id");
  const saleId = params?.id;

  const { data: sale, isLoading } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", saleId],
    enabled: !!saleId,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Sale not found</p>
            <Link href="/pos">
              <Button className="mt-4" data-testid="button-back-to-pos">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to POS
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = sale.paymentStatus === "paid";
  const isPartial = sale.paymentStatus === "partial";
  const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between no-print">
          <Link href="/pos">
            <Button variant="outline" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Button onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print Bill
          </Button>
        </div>

        <Card className="print:shadow-none" data-testid="bill-receipt">
          <CardContent className="p-8 space-y-6">
            <div className="text-center border-b border-border pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                  <span className="text-xl font-bold text-primary-foreground">P</span>
                </div>
                <h1 className="text-2xl font-bold">PaintPulse</h1>
              </div>
              <p className="text-sm text-muted-foreground">Paint Store Management System</p>
              <p className="text-xs text-muted-foreground mt-1">Invoice #{sale.id.slice(0, 8).toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Customer Name</p>
                <p className="font-medium" data-testid="text-customer-name">{sale.customerName}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Phone Number</p>
                <p className="font-medium" data-testid="text-customer-phone">{sale.customerPhone}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Date</p>
                <p className="font-medium">{new Date(sale.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Time</p>
                <p className="font-medium">{new Date(sale.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h2 className="font-semibold mb-3">Items</h2>
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Color</th>
                    <th className="pb-2 font-medium text-muted-foreground">Size</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Qty</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Rate</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.saleItems.map((item, index) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-2">
                        <div>
                          <p className="text-sm">{item.color.colorName}</p>
                          <Badge variant="outline" className="text-xs">{item.color.colorCode}</Badge>
                        </div>
                      </td>
                      <td className="py-2">{item.color.variant.packingSize}</td>
                      <td className="py-2 text-right font-mono">{item.quantity}</td>
                      <td className="py-2 text-right font-mono">Rs. {Math.round(parseFloat(item.rate))}</td>
                      <td className="py-2 text-right font-mono" data-testid={`text-item-subtotal-${index}`}>
                        Rs. {Math.round(parseFloat(item.subtotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-mono">
                  Rs. {Math.round(parseFloat(sale.totalAmount) / 1.18)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (18% GST):</span>
                <span className="font-mono">
                  Rs. {Math.round(parseFloat(sale.totalAmount) - parseFloat(sale.totalAmount) / 1.18)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                <span>Total Amount:</span>
                <span className="font-mono" data-testid="text-total-amount">Rs. {Math.round(parseFloat(sale.totalAmount))}</span>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-mono" data-testid="text-amount-paid">Rs. {Math.round(parseFloat(sale.amountPaid))}</span>
              </div>
              {!isPaid && (
                <div className="flex justify-between text-sm font-semibold text-destructive">
                  <span>Outstanding:</span>
                  <span className="font-mono" data-testid="text-outstanding">Rs. {Math.round(outstanding)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Payment Status:</span>
                <Badge
                  variant={isPaid ? "default" : isPartial ? "secondary" : "outline"}
                  className="ml-2"
                  data-testid="badge-payment-status"
                >
                  {sale.paymentStatus.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="border-t border-border pt-4 text-center">
              <p className="text-sm text-muted-foreground">Thank you for your business!</p>
              <p className="text-xs text-muted-foreground mt-1">
                For any queries, please contact us
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none, .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
