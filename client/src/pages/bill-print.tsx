import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Plus,
  Minus,
  Receipt,
  MoreVertical
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
            {/* Edit and Add Item buttons available for both paid and unpaid bills */}
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
          </div>
          <div className="flex items-center gap-2">
            {/* Three Dots Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePrint}>
                  Print Bill
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setEditMode(!editMode)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {editMode ? "Done Editing" : "Edit Bill"}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setAddItemDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Bill
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card className="print:shadow-none" data-testid="bill-receipt">
          <CardContent className="p-8 space-y-6">
            <div className="text-center border-b border-border pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                  <span className="text-xl font-bold text-primary-foreground">AMP</span>
                </div>
                <h1 className="text-2xl font-bold">A.M Paints</h1>
              </div>
              <p className="text-sm text-muted-foreground">Dunyapur Road, Basti Malook (Multan). 03008683395</p>
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
                <p className="font-medium">{formatDate(sale.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Time</p>
                <p className="font-medium">{new Date(sale.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Items</h2>
                {editMode && (
                  <Badge variant="secondary" className="no-print">
                    Edit Mode
                  </Badge>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Color</th>
                    <th className="pb-2 font-medium text-muted-foreground">Size</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Qty</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Rate</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Amount</th>
                    {editMode && (
                      <th className="pb-2 font-medium text-muted-foreground text-right no-print">Actions</th>
                    )}
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
                      <td className="py-2 text-right font-mono">
                        {editMode ? (
                          <div className="flex items-center justify-end gap-2 no-print">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              disabled={updateQuantityMutation.isPending || item.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="min-w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              disabled={updateQuantityMutation.isPending}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td className="py-2 text-right font-mono">{Math.round(parseFloat(item.rate))}</td>
                      <td className="py-2 text-right font-mono" data-testid={`text-item-subtotal-${index}`}>
                        {Math.round(parseFloat(item.subtotal))}
                      </td>
                      {editMode && (
                        <td className="py-2 text-right no-print">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={deleteItemMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Simplified Amount Section - Removed GST, Subtotal, and Rs. */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
                <span>TOTAL AMOUNT:</span>
                <span className="font-mono" data-testid="text-total-amount">{Math.round(parseFloat(sale.totalAmount))}</span>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AMOUNT PAID:</span>
                <span className="font-mono" data-testid="text-amount-paid">{Math.round(parseFloat(sale.amountPaid))}</span>
              </div>
              {!isPaid && (
                <div className="flex justify-between text-sm font-semibold text-destructive">
                  <span>BALANCE DUE:</span>
                  <span className="font-mono" data-testid="text-outstanding">{Math.round(outstanding)}</span>
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
              Search and select a product to add to the bill. Items can be added even when stock is 0.
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
                          <p className="font-mono font-medium">{Math.round(parseFloat(color.variant.rate))}</p>
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
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Available stock: {selectedColor.stockQuantity} units
                  {selectedColor.stockQuantity === 0 && (
                    <span className="text-destructive font-medium"> (Out of stock - can still add to bill)</span>
                  )}
                </p>
                {selectedColor && (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex justify-between font-mono">
                      <span>Subtotal:</span>
                      <span>{Math.round(parseFloat(selectedColor.variant.rate) * parseInt(quantity || "0"))}</span>
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
        
        .font-mono {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }
      `}</style>
    </div>
  );
}
