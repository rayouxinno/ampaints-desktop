import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, MoreVertical, Edit, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import type { SaleWithItems, ColorWithVariantAndProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function BillPrint() {
  const [, params] = useRoute("/bill/:id");
  const saleId = params?.id;
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorWithVariantAndProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sale, isLoading } = useQuery<SaleWithItems>({
    queryKey: ["/api/sales", saleId],
    enabled: !!saleId,
  });

  const { data: colors = [] } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
    enabled: addItemDialogOpen,
  });

  // Delete Bill
  const deleteSale = async () => {
    if (!saleId) return;
    for (const item of sale?.saleItems || []) {
      await apiRequest("DELETE", `/api/sale-items/${item.id}`);
    }
    await apiRequest("DELETE", `/api/sales/${saleId}`);
    queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    toast({ title: "Bill deleted" });
    window.location.href = "/pos";
  };

  // Print Thermal
  const printThermal = () => {
    setTimeout(() => window.print(), 200);
  };

  // Add Item (Zero Stock Allowed)
  const handleAddItem = () => {
    if (!selectedColor) return toast({ title: "Select product", variant: "destructive" });
    const qty = parseInt(quantity);
    if (qty < 1) return toast({ title: "Invalid quantity", variant: "destructive" });

    const rate = parseFloat(selectedColor.variant.rate);
    apiRequest("POST", `/api/sales/${saleId}/items`, {
      colorId: selectedColor.id,
      quantity: qty,
      rate,
      subtotal: rate * qty,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      toast({ title: "Item added" });
      setAddItemDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setSearchQuery("");
    });
  };

  const filteredColors = useMemo(() => {
    if (!searchQuery) return colors.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return colors
      .filter(c =>
        c.colorName.toLowerCase().includes(q) ||
        c.colorCode.toLowerCase().includes(q) ||
        c.variant.product.company.toLowerCase().includes(q) ||
        c.variant.product.productName.toLowerCase().includes(q) ||
        c.variant.packingSize.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [colors, searchQuery]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-GB");

  if (isLoading) return <div className="p-6"><Skeleton className="h-96 w-full max-w-2xl mx-auto" /></div>;
  if (!sale) return <div className="p-6 text-center text-muted-foreground">Bill not found</div>;

  const outstanding = parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid);
  const isPaid = sale.paymentStatus === "paid";

  // Helper: One Line Product Name
  const getProductLine = (item: any) => {
    return `${item.color.colorName} ${item.color.colorCode} - ${item.color.variant.packingSize}`;
  };

  return (
    <>
      <div className="p-6 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 no-print">
          <Link href="/pos">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </Link>

          <div className="flex gap-3">
            <Button onClick={printThermal} className="font-medium">
              <Receipt className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>

            {!isPaid && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditMode(!editMode)}>
                    <Edit className="h-4 w-4 mr-2" /> {editMode ? "Done" : "Edit"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAddItemDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Bill
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Screen View */}
        <Card className="print:hidden">
          <CardContent className="p-8 space-y-6">
            <div className="text-center border-b pb-4">
              <h1 className="text-2xl font-bold">A.M PAINTS</h1>
              <p className="text-sm text-muted-foreground">Basti Malook, Multan | 0300-8683395</p>
              <p className="text-xs mt-1">Invoice: {sale.id.slice(0, 8).toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Customer:</span> <strong>{sale.customerName}</strong></div>
              <div><span className="text-muted-foreground">Phone:</span> <strong>{sale.customerPhone}</strong></div>
              <div><span className="text-muted-foreground">Date:</span> <strong>{formatDate(sale.createdAt)}</strong></div>
              <div><span className="text-muted-foreground">Time:</span> <strong>{new Date(sale.createdAt).toLocaleTimeString()}</strong></div>
            </div>

            <div className="border-t pt-4">
              <h2 className="font-semibold mb-3 flex justify-between">
                <span>Items</span>
                {editMode && <Badge variant="secondary">Edit Mode</Badge>}
              </h2>

              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left pb-2">Product</th>
                    <th className="text-right pb-2">Qty</th>
                    <th className="text-right pb-2">Rate</th>
                    <th className="text-right pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.saleItems.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        {getProductLine(item)}
                      </td>
                      <td className="py-3 text-right">{item.quantity}</td>
                      <td className="py-3 text-right">Rs. {Math.round(parseFloat(item.rate))}</td>
                      <td className="py-3 text-right font-bold">Rs. {Math.round(parseFloat(item.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t pt-4 space-y-2 text-lg">
              <div className="flex justify-between font-bold">
                <span>Total : </span>
                <span>{Math.round(parseFloat(sale.totalAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid : </span>
                <span>{Math.round(parseFloat(sale.amountPaid))}</span>
              </div>
              {!isPaid && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance : </span>
                  <span>{Math.round(outstanding)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Status : </span>
                <Badge variant={isPaid ? "default" : "secondary"}>
                  {sale.paymentStatus.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="text-center border-t pt-4">
              <p className="font-medium">Thank you!</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRINT ONLY: Thermal Receipt */}
      <div className="hidden print:block font-mono text-xs leading-tight">
        <div className="w-[80mm] mx-auto p-4 bg-white">
          <div className="text-center">
            <h1 className="font-bold text-lg">ALI MUHAMMAD PAINTS</h1>
            <p>Basti Malook, Multan. 0300-868-3395</p>
           
           
          </div>

          <div className="my-3 border-t border-dotted border-black pt-2">
            <p className="mt-2">Invoice: {sale.id.slice(0, 8).toUpperCase()}</p>
            <p>{formatDate(sale.createdAt)} {new Date(sale.createdAt).toLocaleTimeString()}</p>
            <p>Customer: {sale.customerName}</p>
            <p>Phone: {sale.customerPhone}</p>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left">#</th>
                <th className="text-left">Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">price</th>
                <th className="text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {sale.saleItems.map((item, i) => (
                <tr key={item.id}>
                  <td>{i + 1}</td>
                  <td className="py-1">
                    <div className="font-medium">
                      {item.color.colorName} {item.color.colorCode} - {item.color.variant.packingSize}
                    </div>
                  </td>
                  <td className="text-right py-1">{item.quantity}</td>
                  <td className="text-right py-1">{Math.round(parseFloat(item.rate))}</td>
                  <td className="text-right font-bold py-1">{Math.round(parseFloat(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-black mt-3 pt-2">
            <div className="flex flex-col items-end text-right space-y-1">
              <div className="flex justify-between w-48">
                <span className="font-bold w-24 text-right">Total:</span>
                <span className="w-24 text-right">{Math.round(parseFloat(sale.totalAmount))}</span>
              </div>
              <div className="flex justify-between w-48">
                <span className="w-24 text-right">Paid:</span>
                <span className="w-24 text-right">{Math.round(parseFloat(sale.amountPaid))}</span>
              </div>
              {outstanding > 0 && (
                <div className="flex justify-between w-48 font-bold">
                  <span className="w-24 text-right">Balance:</span>
                  <span className="w-24 text-right">{Math.round(outstanding)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mt-4 border-t border-black pt-2">
            <p className="text-[9px] mt-1 font-bold uppercase">
              Authorized Dealer:
            </p>
            <p className="text-[9px] font-semibold">
              DULUX • MOBI PAINTS • WESTER 77
            </p>
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Bill?</DialogTitle></DialogHeader>
          <p>This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteSale}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Item</DialogTitle></DialogHeader>
          <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <div className="max-h-64 overflow-y-auto my-4 space-y-2">
            {filteredColors.map(c => (
              <Card
                key={c.id}
                className={`p-4 cursor-pointer transition ${selectedColor?.id === c.id ? "border-primary bg-accent" : ""}`}
                onClick={() => setSelectedColor(c)}
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{c.colorName} {c.colorCode} - {c.variant.packingSize}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.variant.product.company} • {c.variant.product.productName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">Rs. {Math.round(parseFloat(c.variant.rate))}</p>
                    <Badge variant={c.stockQuantity > 0 ? "default" : "destructive"}>
                      Stock: {c.stockQuantity}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {selectedColor && (
            <div className="space-y-3">
              <Label>Quantity</Label>
              <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
              <p className="text-xs text-muted-foreground">Zero stock allowed</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!selectedColor}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print CSS */}
      <style jsx>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { padding: 3mm; font-family: 'Courier New', monospace; font-size: 10px; }
          .no-print, dialog, button { display: none !important; }
        }
      `}</style>
    </>
  );
}
