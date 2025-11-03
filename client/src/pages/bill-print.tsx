import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Printer, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Plus,
  Minus
} from "lucide-react";
import { Link } from "wouter";
import type { SaleWithItems, ColorWithVariantAndProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const deleteSaleMutation = useMutation({
    mutationFn: async () => {
      if (!saleId) throw new Error("No sale ID");
      
      // First delete all sale items to maintain referential integrity
      for (const item of sale?.saleItems || []) {
        await apiRequest("DELETE", `/api/sale-items/${item.id}`);
      }
      
      // Then delete the sale
      return await apiRequest("DELETE", `/api/sales/${saleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Bill deleted successfully" });
      window.location.href = "/pos";
    },
    onError: () => {
      toast({ title: "Failed to delete bill", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (saleItemId: string) => {
      return await apiRequest("DELETE", `/api/sale-items/${saleItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Item removed from bill" });
    },
    onError: () => {
      toast({ title: "Failed to remove item", variant: "destructive" });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      // Since we don't have a direct update endpoint, we'll delete and recreate the item
      // First get the current item details
      const sale = await apiRequest("GET", `/api/sales/${saleId}`).then(res => res.json());
      const item = sale.saleItems.find((item: any) => item.id === itemId);
      
      if (!item) throw new Error("Item not found");
      
      // Delete the current item
      await apiRequest("DELETE", `/api/sale-items/${itemId}`);
      
      // Create new item with updated quantity
      const newSubtotal = parseFloat(item.rate) * quantity;
      return await apiRequest("POST", `/api/sales/${saleId}/items`, {
        colorId: item.color.id,
        quantity: quantity,
        rate: parseFloat(item.rate),
        subtotal: newSubtotal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Quantity updated" });
    },
    onError: () => {
      toast({ title: "Failed to update quantity", variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { colorId: string; quantity: number; rate: number; subtotal: number }) => {
      return await apiRequest("POST", `/api/sales/${saleId}/items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales", saleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/unpaid"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      toast({ title: "Product added to bill" });
      setAddItemDialogOpen(false);
      setSelectedColor(null);
      setQuantity("1");
      setSearchQuery("");
    },
    onError: () => {
      toast({ title: "Failed to add product", variant: "destructive" });
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteBill = () => {
    if (!saleId) return;
    deleteSaleMutation.mutate();
  };

  const handleRemoveItem = (itemId: string) => {
    deleteItemMutation.mutate(itemId);
  };

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      toast({ title: "Quantity must be at least 1", variant: "destructive" });
      return;
    }
    updateQuantityMutation.mutate({ itemId, quantity: newQuantity });
  };

  const handleAddItem = () => {
    if (!selectedColor || !saleId) {
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
      colorId: selectedColor.id,
      quantity: qty,
      rate,
      subtotal,
    });
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

  // Format date to dd-mm-yyyy
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
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
          <div className="flex items-center gap-2">
            <Link href="/pos">
              <Button variant="outline" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            {!isPaid && (
              <>
                <Button 
                  variant={editMode ? "default" : "outline"}
                  onClick={() => setEditMode(!editMode)}
                  data-testid="button-edit-mode"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {editMode ? "Done Editing" : "Edit Bill"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setAddItemDialogOpen(true)}
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="destructive" 
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="button-delete-bill"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Bill
            </Button>
            <Button onClick={handlePrint} data-testid="button-print">
              <Printer className="h-4 w-4 mr-2" />
              Print Bill
            </Button>
          </div>
        </div>

        <Card className="print:shadow-none print:border-0" data-testid="bill-receipt">
          <CardContent className="p-4 print:p-2 space-y-4 print:space-y-2">
            {/* Header - Compact for thermal printer */}
            <div className="text-center border-b border-black pb-2 print:pb-1">
              <h1 className="text-xl print:text-lg font-bold leading-tight">ALI MUHAMMAD Paints</h1>
              <p className="text-xs print:text-xs leading-tight">Basti Malook (Multan). 03008683395</p>
              <p className="text-xs print:text-xs mt-1">Invoice #{sale.id.slice(0, 8).toUpperCase()}</p>
            </div>

            {/* Customer Info - Compact */}
            <div className="grid grid-cols-2 gap-2 text-sm print:text-xs">
              <div>
                <p className="font-medium mb-1">Customer:</p>
                <p className="font-bold" data-testid="text-customer-name">{sale.customerName}</p>
              </div>
              <div>
                <p className="font-medium mb-1">Phone:</p>
                <p className="font-bold" data-testid="text-customer-phone">{sale.customerPhone}</p>
              </div>
              <div className="col-span-2">
                <p className="font-medium mb-1">Date:</p>
                <p className="font-bold">{formatDate(sale.createdAt)}</p>
              </div>
            </div>

            {/* Items Table - Compact */}
            <div className="border-t border-black pt-2 print:pt-1">
              <div className="flex items-center justify-between mb-2 print:mb-1">
                <h2 className="font-semibold text-sm print:text-sm">ITEMS</h2>
                {editMode && (
                  <Badge variant="secondary" className="no-print text-xs">
                    Edit Mode
                  </Badge>
                )}
              </div>
              <table className="w-full text-xs print:text-xs">
                <thead>
                  <tr className="border-b border-black text-left">
                    <th className="pb-1 font-bold w-8">#</th>
                    <th className="pb-1 font-bold">Product</th>
                    <th className="pb-1 font-bold text-right w-12">Qty</th>
                    <th className="pb-1 font-bold text-right w-16">Rate</th>
                    <th className="pb-1 font-bold text-right w-20">Amount</th>
                    {editMode && (
                      <th className="pb-1 font-bold text-right w-12 no-print">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sale.saleItems.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-300 last:border-0">
                      <td className="py-1 align-top">{index + 1}</td>
                      <td className="py-1 align-top">
                        <div>
                          <p className="font-medium leading-tight">{item.color.colorName}</p>
                          <Badge variant="outline" className="text-xs px-1 py-0 leading-tight">
                            {item.color.colorCode}
                          </Badge>
                          <p className="text-xs text-muted-foreground leading-tight">
                            {item.color.variant.packingSize}
                          </p>
                        </div>
                      </td>
                      <td className="py-1 text-right font-mono align-top">
                        {editMode ? (
                          <div className="flex items-center justify-end gap-1 no-print">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              disabled={updateQuantityMutation.isPending || item.quantity <= 1}
                            >
                              <Minus className="h-2 w-2" />
                            </Button>
                            <span className="min-w-6 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              disabled={updateQuantityMutation.isPending}
                            >
                              <Plus className="h-2 w-2" />
                            </Button>
                          </div>
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td className="py-1 text-right font-mono align-top">Rs.{Math.round(parseFloat(item.rate))}</td>
                      <td className="py-1 text-right font-mono font-bold align-top" data-testid={`text-item-subtotal-${index}`}>
                        Rs.{Math.round(parseFloat(item.subtotal))}
                      </td>
                      {editMode && (
                        <td className="py-1 text-right align-top no-print">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={deleteItemMutation.isPending}
                          >
                            <Trash2 className="h-2 w-2" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals - Simplified without GST */}
            <div className="border-t border-black pt-2 print:pt-1 space-y-1">
              <div className="flex justify-between text-sm print:text-sm font-bold border-t border-black pt-1">
                <span>TOTAL AMOUNT:</span>
                <span className="font-mono" data-testid="text-total-amount">Rs.{Math.round(parseFloat(sale.totalAmount))}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="border-t border-black pt-2 print:pt-1 space-y-1">
              <div className="flex justify-between text-sm print:text-sm">
                <span className="font-medium">Amount Paid:</span>
                <span className="font-mono font-bold" data-testid="text-amount-paid">Rs.{Math.round(parseFloat(sale.amountPaid))}</span>
              </div>
              {!isPaid && (
                <div className="flex justify-between text-sm print:text-sm font-bold text-destructive">
                  <span>Outstanding:</span>
                  <span className="font-mono" data-testid="text-outstanding">Rs.{Math.round(outstanding)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm print:text-sm font-medium">Status:</span>
                <Badge
                  variant={isPaid ? "default" : isPartial ? "secondary" : "outline"}
                  className="ml-2 text-xs print:text-xs"
                  data-testid="badge-payment-status"
                >
                  {sale.paymentStatus.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-black pt-2 print:pt-1 text-center">
              <p className="text-sm print:text-xs font-bold">Thank you for your business!</p>
              <p className="text-xs print:text-xs mt-1">
                For queries: 03008683395
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bill</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bill? This action cannot be undone and will remove all items from this sale.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteSaleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteBill}
              disabled={deleteSaleMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteSaleMutation.isPending ? "Deleting..." : "Delete Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
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
              <Input
                placeholder="Search by color code, name, company, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3"
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
                  setAddItemDialogOpen(false);
                  setSelectedColor(null);
                  setQuantity("1");
                  setSearchQuery("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddItem}
                disabled={!selectedColor || addItemMutation.isPending}
              >
                {addItemMutation.isPending ? "Adding..." : "Add Product"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:shadow-none, .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
          .no-print {
            display: none !important;
          }
          /* Thermal printer optimization */
          @page {
            margin: 0;
            padding: 0;
            size: auto;
          }
          body {
            margin: 0;
            padding: 0;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', monospace !important;
            font-weight: bold !important;
            line-height: 1 !important;
          }
          /* Ensure maximum contrast for thermal printers */
          * {
            color: black !important;
            background: white !important;
            border-color: black !important;
          }
          /* Compact spacing for thermal paper */
          .space-y-4 > * + * {
            margin-top: 0.5rem !important;
          }
          .space-y-2 > * + * {
            margin-top: 0.25rem !important;
          }
        }
      `}</style>
    </div>
  );
}
