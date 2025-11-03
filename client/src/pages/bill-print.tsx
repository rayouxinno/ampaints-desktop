import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Minus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteSale, getSaleById } from "@/lib/api"; // adjust your API paths

export default function BillPrint() {
  const [, params] = useRoute("/bill/:id");
  const saleId = params?.id;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSaleById(saleId),
    enabled: !!saleId,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSale,
    onSuccess: () => {
      toast.success("Sale deleted successfully");
      window.history.back();
    },
    onError: () => toast.error("Error deleting sale"),
  });

  const handleDelete = () => {
    if (saleId) deleteMutation.mutate(saleId);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (d) => {
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  if (isLoading || !sale) {
    return (
      <div className="flex justify-center items-center h-screen text-lg font-semibold">
        Loading Sale...
      </div>
    );
  }

  const outstanding = sale.totalAmount - sale.amountPaid;

  return (
    <div className="flex flex-col items-center w-full py-4 print:p-0">
      {/* Top Action Bar */}
      <div className="flex gap-2 mb-4 print:hidden">
        <Link href="/sales">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <Button onClick={() => handlePrint()} size="sm">
          <Printer className="w-4 h-4 mr-1" /> Print
        </Button>
        <Button variant="outline" size="sm">
          <Edit className="w-4 h-4 mr-1" /> Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </div>

      {/* Bill Template */}
      <Card className="w-[80mm] print:w-[80mm] print:shadow-none print:border-0 border-0">
        <CardContent className="p-3 space-y-3 text-black">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-lg font-bold leading-tight">
              {sale.shopName || "ALI MUHAMMAD Paints"}
            </h1>
            {sale.shopAddress && (
              <p className="text-xs leading-tight">{sale.shopAddress}</p>
            )}
            <p className="text-xs mt-1">Invoice #{sale.id}</p>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="font-medium">Customer:</p>
              <p className="font-bold break-words">{sale.customerName}</p>
            </div>
            <div>
              <p className="font-medium">Phone:</p>
              <p className="font-bold">{sale.customerPhone}</p>
            </div>
            <div className="col-span-2">
              <p className="font-medium">Date:</p>
              <p className="font-bold">{formatDate(sale.createdAt)}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="pt-2">
            <table className="w-full text-xs text-black border-collapse">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="pb-1 w-6">#</th>
                  <th className="pb-1">Description</th>
                  <th className="pb-1 text-right w-12">Size</th>
                  <th className="pb-1 text-right w-10">Qty</th>
                  <th className="pb-1 text-right w-14">Rate</th>
                  <th className="pb-1 text-right w-16">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.saleItems.map((item, i) => (
                  <tr
                    key={item.id}
                    className="border-b border-dotted border-gray-400 last:border-0 align-top"
                  >
                    <td className="py-1 align-top">{i + 1}</td>
                    <td className="py-1 align-top whitespace-normal leading-snug pr-2">
                      <p className="font-medium break-words">
                        {item.name}, <span className="font-bold">{item.code}</span>
                      </p>
                    </td>
                    <td className="py-1 text-right font-mono align-top">{item.size}</td>
                    <td className="py-1 text-right font-mono align-top">{item.qty}</td>
                    <td className="py-1 text-right font-mono align-top">{item.rate}</td>
                    <td className="py-1 text-right font-mono font-bold align-top">
                      {item.subtotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="pt-2 space-y-1 text-sm text-right text-black border-t border-black">
            <div className="font-bold">
              <span>Total Amount: </span>
              <span className="font-mono ml-2">{sale.totalAmount}</span>
            </div>
            <div>
              <span>Amount Paid: </span>
              <span className="font-mono font-bold ml-2">{sale.amountPaid}</span>
            </div>
            {outstanding > 0 && (
              <div className="font-bold">
                <span>Outstanding: </span>
                <span className="font-mono ml-2">{outstanding}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 mt-2 text-center border-t border-black">
            <p className="text-sm font-normal">
              Thank you for your business!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-md space-y-3 w-[300px]">
            <p className="text-center font-semibold text-sm">
              Are you sure you want to delete this sale?
            </p>
            <div className="flex justify-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body * { visibility: hidden; }
          .print\\:shadow-none, .print\\:shadow-none * { visibility: visible; }
          .print\\:shadow-none { position: absolute; left: 0; top: 0; width: 80mm; }
          body { font-family: 'Courier New', monospace !important; font-weight: bold; color: black !important; background: white !important; }
        }
      `}</style>
    </div>
  );
}
