import { useState, useMemo, useEffect } from "react";
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
import { Plus, Package, Palette, Layers, TruckIcon, Search, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, VariantWithProduct, ColorWithVariantAndProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Existing schemas (unchanged)
const productFormSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  productName: z.string().min(1, "Product name is required"),
});

const variantFormSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  packingSize: z.string().min(1, "Packing size is required"),
  rate: z.string().min(1, "Rate is required"),
});

const colorFormSchema = z.object({
  variantId: z.string().min(1, "Variant is required"),
  colorName: z.string().min(1, "Color name is required"),
  colorCode: z.string().min(1, "Color code is required"),
  stockQuantity: z.string().min(1, "Quantity is required"),
});

const stockInFormSchema = z.object({
  colorId: z.string().min(1, "Color is required"),
  quantity: z.string().min(1, "Quantity is required"),
});

// New wizard-local types
type QuickVariant = {
  id: string;
  packingSize: string;
  rate: string;
};

type QuickColor = {
  id: string;
  colorName: string;
  colorCode: string;
  stockQuantity: string;
};

export default function StockManagement() {
  // Existing UI state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);

  // New Quick Add wizard state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickStep, setQuickStep] = useState<number>(1);
  const [quickCompany, setQuickCompany] = useState("");
  const [quickProductName, setQuickProductName] = useState("");
  const [quickVariants, setQuickVariants] = useState<QuickVariant[]>(() => [
    { id: `${Date.now()}-v0`, packingSize: "", rate: "" },
  ]);
  const [quickColors, setQuickColors] = useState<QuickColor[]>(() => [
    { id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" },
  ]);
  const { toast } = useToast();

  // Existing queries
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: variantsData = [], isLoading: variantsLoading } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
  });

  const { data: colorsData = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  // Search states
  const [colorSearchQuery, setColorSearchQuery] = useState("");
  const [stockInSearchQuery, setStockInSearchQuery] = useState("");
  const [selectedColorForStockIn, setSelectedColorForStockIn] = useState<ColorWithVariantAndProduct | null>(null);

  // Existing forms (unchanged)
  const productForm = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { company: "", productName: "" },
  });

  const variantForm = useForm<z.infer<typeof variantFormSchema>>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: { productId: "", packingSize: "", rate: "" },
  });

  const colorForm = useForm<z.infer<typeof colorFormSchema>>({
    resolver: zodResolver(colorFormSchema),
    defaultValues: { variantId: "", colorName: "", colorCode: "", stockQuantity: "" },
  });

  const stockInForm = useForm<z.infer<typeof stockInFormSchema>>({
    resolver: zodResolver(stockInFormSchema),
    defaultValues: { colorId: "", quantity: "" },
  });

  // Auto-append empty rows for quick add
  useEffect(() => {
    const lastVariant = quickVariants[quickVariants.length - 1];
    if (lastVariant && (lastVariant.packingSize.trim() !== "" || lastVariant.rate.trim() !== "")) {
      setQuickVariants((prev) => [...prev, { id: String(Date.now()), packingSize: "", rate: "" }]);
    }
  }, [quickVariants]);

  useEffect(() => {
    const lastColor = quickColors[quickColors.length - 1];
    if (lastColor && (lastColor.colorName.trim() !== "" || lastColor.colorCode.trim() !== "" || lastColor.stockQuantity.trim() !== "")) {
      setQuickColors((prev) => [...prev, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "" }]);
    }
  }, [quickColors]);

  // Quick Add mutations
  const createProductMutation = useMutation({
    mutationFn: async (data: { company: string; productName: string }) => {
      const res = await apiRequest("POST", "/api/products", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: async (data: { productId: string; packingSize: string; rate: number }) => {
      const res = await apiRequest("POST", "/api/variants", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
    },
  });

  const createColorMutation = useMutation({
    mutationFn: async (data: { variantId: string; colorName: string; colorCode: string; stockQuantity: number }) => {
      const res = await apiRequest("POST", "/api/colors", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    },
  });

  // Quick Add final save
  const [isSavingQuick, setIsSavingQuick] = useState(false);
  const saveQuickAdd = async () => {
    if (!quickCompany.trim()) {
      toast({ title: "Company is required", variant: "destructive" });
      setQuickStep(1);
      return;
    }
    if (!quickProductName.trim()) {
      toast({ title: "Product name is required", variant: "destructive" });
      setQuickStep(1);
      return;
    }

    const finalVariants = quickVariants
      .filter((v) => v.packingSize.trim() !== "" && v.rate.trim() !== "")
      .map((v) => ({ packingSize: v.packingSize.trim(), rate: v.rate.trim() }));

    if (finalVariants.length === 0) {
      toast({ title: "Add at least one variant", variant: "destructive" });
      setQuickStep(2);
      return;
    }

    const finalColors = quickColors
      .filter((c) => c.colorName.trim() !== "" && c.colorCode.trim() !== "" && c.stockQuantity.trim() !== "")
      .map((c) => ({ colorName: c.colorName.trim(), colorCode: c.colorCode.trim(), stockQuantity: c.stockQuantity.trim() }));

    if (finalColors.length === 0) {
      toast({ 
        title: "No colors added", 
        description: "You can add colors later from Colors tab.", 
        variant: "default" 
      });
    }

    setIsSavingQuick(true);
    try {
      // Create product
      const productResp = await createProductMutation.mutateAsync({
        company: quickCompany.trim(),
        productName: quickProductName.trim(),
      });
      
      const productId = productResp.id;
      if (!productId) {
        throw new Error("Product creation failed: no id returned");
      }

      // Create variants
      const createdVariantIds: string[] = [];
      for (const variant of finalVariants) {
        const variantResp = await createVariantMutation.mutateAsync({
          productId,
          packingSize: variant.packingSize,
          rate: parseFloat(variant.rate),
        });
        createdVariantIds.push(variantResp.id);
      }

      // Create colors for each variant
      if (finalColors.length > 0) {
        for (const variantId of createdVariantIds) {
          for (const color of finalColors) {
            await createColorMutation.mutateAsync({
              variantId,
              colorName: color.colorName,
              colorCode: color.colorCode,
              stockQuantity: parseInt(color.stockQuantity, 10),
            });
          }
        }
      }

      toast({ 
        title: "Saved successfully", 
        description: "Product, variants and colors added successfully." 
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });

      // Reset wizard
      setIsQuickAddOpen(false);
      setQuickStep(1);
      setQuickCompany("");
      setQuickProductName("");
      setQuickVariants([{ id: `${Date.now()}-v0`, packingSize: "", rate: "" }]);
      setQuickColors([{ id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" }]);
    } catch (err: any) {
      console.error("Quick Add save error:", err);
      toast({ 
        title: "Save failed", 
        description: err?.message || "Unknown error occurred", 
        variant: "destructive" 
      });
    } finally {
      setIsSavingQuick(false);
    }
  };

  // Color search filters (existing code)
  const filteredColors = useMemo(() => {
    const query = colorSearchQuery.toLowerCase().trim();
    if (!query) return colorsData;

    return colorsData
      .map((color) => {
        let score = 0;
        const colorCode = color.colorCode.toLowerCase();
        const colorName = color.colorName.toLowerCase();
        const company = color.variant.product.company.toLowerCase();
        const product = color.variant.product.productName.toLowerCase();
        const size = color.variant.packingSize.toLowerCase();

        if (colorCode === query) score += 1000;
        else if (colorCode.startsWith(query)) score += 500;
        else if (colorCode.includes(query)) score += 100;

        if (colorName === query) score += 200;
        else if (colorName.includes(query)) score += 50;

        if (company.includes(query)) score += 30;
        if (product.includes(query)) score += 30;
        if (size.includes(query)) score += 20;

        return { color, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ color }) => color);
  }, [colorsData, colorSearchQuery]);

  const filteredColorsForStockIn = useMemo(() => {
    const query = stockInSearchQuery.toLowerCase().trim();
    if (!query) return colorsData;

    return colorsData
      .map((color) => {
        let score = 0;
        const colorCode = color.colorCode.toLowerCase();
        const colorName = color.colorName.toLowerCase();
        const company = color.variant.product.company.toLowerCase();
        const product = color.variant.product.productName.toLowerCase();
        const size = color.variant.packingSize.toLowerCase();

        if (colorCode === query) score += 1000;
        else if (colorCode.startsWith(query)) score += 500;
        else if (colorCode.includes(query)) score += 100;

        if (colorName === query) score += 200;
        else if (colorName.includes(query)) score += 50;

        if (company.includes(query)) score += 30;
        if (product.includes(query)) score += 30;
        if (size.includes(query)) score += 20;

        return { color, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ color }) => color);
  }, [colorsData, stockInSearchQuery]);

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (stock < 10) return <Badge variant="secondary">Low Stock</Badge>;
    return <Badge variant="default">In Stock</Badge>;
  };

  // UI helpers for quick add tables
  const updateVariant = (index: number, key: keyof QuickVariant, value: string) => {
    setQuickVariants((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [key]: value };
      return clone;
    });
  };

  const removeVariantAt = (index: number) => {
    setQuickVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateColor = (index: number, key: keyof QuickColor, value: string) => {
    setQuickColors((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [key]: value };
      return clone;
    });
  };

  const removeColorAt = (index: number) => {
    setQuickColors((prev) => prev.filter((_, i) => i !== index));
  };

  // Keep existing single-item mutations (unchanged)
  const createProductSingleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      const res = await apiRequest("POST", "/api/products", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Product created successfully" });
      productForm.reset();
      setIsProductDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create product", variant: "destructive" });
    },
  });

  const createVariantSingleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof variantFormSchema>) => {
      const res = await apiRequest("POST", "/api/variants", {
        ...data,
        rate: parseFloat(data.rate),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      toast({ title: "Variant created successfully" });
      variantForm.reset();
      setIsVariantDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create variant", variant: "destructive" });
    },
  });

  const createColorSingleMutation = useMutation({
    mutationFn: async (data: z.infer<typeof colorFormSchema>) => {
      const res = await apiRequest("POST", "/api/colors", {
        ...data,
        stockQuantity: parseInt(data.stockQuantity),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Color added successfully" });
      colorForm.reset();
      setIsColorDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to add color", variant: "destructive" });
    },
  });

  const stockInMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stockInFormSchema>) => {
      const res = await apiRequest("POST", `/api/colors/${data.colorId}/stock-in`, {
        quantity: parseInt(data.quantity),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({ title: "Stock added successfully" });
      stockInForm.reset();
      setIsStockInDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to add stock", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Management</h1>
          <p className="text-sm text-muted-foreground">Manage products, variants, and colors</p>
        </div>
      </div>

      <Tabs defaultValue="quick-add" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quick-add">
            <Package className="mr-2 h-4 w-4" />
            Quick Add
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="mr-2 h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="variants">
            <Layers className="mr-2 h-4 w-4" />
            Variants
          </TabsTrigger>
          <TabsTrigger value="colors">
            <Palette className="mr-2 h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="stock-in">
            <TruckIcon className="mr-2 h-4 w-4" />
            Stock In
          </TabsTrigger>
        </TabsList>

        {/* Quick Add Tab */}
        <TabsContent value="quick-add" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between gap-4">
              <CardTitle>Quick Add — Wizard</CardTitle>
              <div>
                <Dialog open={isQuickAddOpen} onOpenChange={(open) => { 
                  setIsQuickAddOpen(open); 
                  if (!open) { 
                    setQuickStep(1);
                    setQuickCompany("");
                    setQuickProductName("");
                    setQuickVariants([{ id: `${Date.now()}-v0`, packingSize: "", rate: "" }]);
                    setQuickColors([{ id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" }]);
                  } 
                }}>
                  <Button onClick={() => setIsQuickAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Quick Add
                  </Button>

                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Quick Add Product (Wizard)</DialogTitle>
                      <DialogDescription>Fill product → variants → colors → save</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                      {/* Progress */}
                      <div className="flex gap-2 items-center text-sm">
                        <div className={`px-3 py-1 rounded ${quickStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>1. Product</div>
                        <div className={`px-3 py-1 rounded ${quickStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>2. Variants</div>
                        <div className={`px-3 py-1 rounded ${quickStep === 3 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>3. Colors</div>
                        <div className={`px-3 py-1 rounded ${quickStep === 4 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>4. Review</div>
                      </div>

                      {/* Step 1: Product */}
                      {quickStep === 1 && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="quick-company">Company Name</Label>
                              <Input
                                id="quick-company"
                                value={quickCompany}
                                placeholder="e.g., Premium Paint Co"
                                onChange={(e) => setQuickCompany(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="quick-product">Product Name</Label>
                              <Input
                                id="quick-product"
                                value={quickProductName}
                                placeholder="e.g., Exterior Emulsion"
                                onChange={(e) => setQuickProductName(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={() => setQuickStep(2)} disabled={!quickCompany.trim() || !quickProductName.trim()}>
                              Next →
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Step 2: Variants */}
                      {quickStep === 2 && (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium mb-3">Variants — add sizes and rates</h4>
                            <div className="space-y-3">
                              <div className="grid grid-cols-12 gap-2 font-semibold border-b pb-2 text-sm">
                                <div className="col-span-6">Packing Size</div>
                                <div className="col-span-4">Rate (Rs.)</div>
                                <div className="col-span-2">Actions</div>
                              </div>

                              {quickVariants.map((variant, index) => (
                                <div key={variant.id} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-6">
                                    <Input
                                      placeholder="e.g., 1L, 4L, 16L"
                                      value={variant.packingSize}
                                      onChange={(e) => updateVariant(index, "packingSize", e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="e.g., 250"
                                      value={variant.rate}
                                      onChange={(e) => updateVariant(index, "rate", e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => removeVariantAt(index)}
                                      disabled={quickVariants.length === 1}
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}

                              <div>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => setQuickVariants((p) => [...p, { id: String(Date.now()), packingSize: "", rate: "" }])}
                                >
                                  <Plus className="mr-2 h-4 w-4" /> Add Row
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between">
                            <Button variant="ghost" onClick={() => setQuickStep(1)}>← Back</Button>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                              <Button onClick={() => setQuickStep(3)}>
                                Next →
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Colors */}
                      {quickStep === 3 && (
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium mb-3">Colors — add name, code & quantity</h4>
                            <div className="space-y-3">
                              <div className="grid grid-cols-12 gap-2 font-semibold border-b pb-2 text-sm">
                                <div className="col-span-4">Color Name</div>
                                <div className="col-span-4">Color Code</div>
                                <div className="col-span-3">Quantity</div>
                                <div className="col-span-1">Actions</div>
                              </div>

                              {quickColors.map((color, index) => (
                                <div key={color.id} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-4">
                                    <Input 
                                      placeholder="e.g., Sky Blue" 
                                      value={color.colorName}
                                      onChange={(e) => updateColor(index, "colorName", e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <Input 
                                      placeholder="e.g., RAL 5002" 
                                      value={color.colorCode}
                                      onChange={(e) => updateColor(index, "colorCode", e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-3">
                                    <Input 
                                      type="number" 
                                      min="0" 
                                      placeholder="0" 
                                      value={color.stockQuantity}
                                      onChange={(e) => updateColor(index, "stockQuantity", e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => removeColorAt(index)}
                                      disabled={quickColors.length === 1}
                                    >
                                      <Trash className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}

                              <div>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => setQuickColors((p) => [...p, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "" }])}
                                >
                                  <Plus className="mr-2 h-4 w-4" /> Add Row
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between">
                            <Button variant="ghost" onClick={() => setQuickStep(2)}>← Back</Button>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                              <Button onClick={() => setQuickStep(4)}>
                                Next: Review →
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 4: Review */}
                      {quickStep === 4 && (
                        <div className="space-y-4">
                          <h4 className="text-sm font-medium">Review</h4>
                          <div className="space-y-3">
                            <div className="border rounded p-3">
                              <p className="font-medium">Company: <span className="font-normal">{quickCompany}</span></p>
                              <p className="font-medium">Product: <span className="font-normal">{quickProductName}</span></p>
                            </div>

                            <div className="border rounded p-3">
                              <p className="font-medium mb-2">Variants</p>
                              <div className="space-y-2">
                                {quickVariants
                                  .filter(v => v.packingSize.trim() !== "" && v.rate.trim() !== "")
                                  .map((v, index) => (
                                  <div key={index} className="flex justify-between">
                                    <span>{v.packingSize}</span>
                                    <span>Rs. {v.rate}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="border rounded p-3">
                              <p className="font-medium mb-2">Colors (will be added to each variant)</p>
                              <div className="space-y-2">
                                {quickColors
                                  .filter(c => c.colorName.trim() !== "" && c.colorCode.trim() !== "")
                                  .map((c, index) => (
                                  <div key={index} className="flex justify-between">
                                    <span>{c.colorName} ({c.colorCode})</span>
                                    <span>Qty: {c.stockQuantity || 0}</span>
                                  </div>
                                ))}
                                {quickColors.filter(c => c.colorName.trim() !== "" && c.colorCode.trim() !== "").length === 0 && (
                                  <p className="text-sm text-muted-foreground">No colors added</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between">
                            <Button variant="ghost" onClick={() => setQuickStep(3)}>← Back</Button>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                              <Button onClick={saveQuickAdd} disabled={isSavingQuick}>
                                {isSavingQuick ? "Saving..." : "Save Product"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use the Quick Add wizard for fast entry: Product → Variants → Colors → Save.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rest of the tabs (Products, Variants, Colors, Stock In) remain unchanged */}
        {/* ... existing code for other tabs ... */}
        
      </Tabs>
    </div>
  );
}
