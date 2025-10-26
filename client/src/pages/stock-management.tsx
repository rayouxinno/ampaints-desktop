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
import {
  Plus,
  Package,
  Palette,
  Layers,
  TruckIcon,
  Search,
  Trash,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, VariantWithProduct, ColorWithVariantAndProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* -------------------------
   Validation schemas
   ------------------------- */
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

/* -------------------------
   Quick Add local types
   ------------------------- */
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

/* -------------------------
   Main component
   ------------------------- */
export default function StockManagement() {
  /* Dialog visibility */
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);

  /* Quick Add wizard */
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickStep, setQuickStep] = useState<number>(1); // 1: product, 2: variants, 3: colors
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [newCompany, setNewCompany] = useState<string>("");
  const [newProduct, setNewProduct] = useState<string>("");
  const [useExistingCompany, setUseExistingCompany] = useState<boolean>(true);
  const [useExistingProduct, setUseExistingProduct] = useState<boolean>(true);
  const [quickVariants, setQuickVariants] = useState<QuickVariant[]>(() => [
    { id: `${Date.now()}-v0`, packingSize: "", rate: "" },
  ]);
  const [quickColors, setQuickColors] = useState<QuickColor[]>(() => [
    { id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" },
  ]);
  const [expandedSections, setExpandedSections] = useState({ variants: true, colors: true });

  const { toast } = useToast();

  /* Search & stock-in state */
  const [colorSearchQuery, setColorSearchQuery] = useState("");
  const [stockInSearchQuery, setStockInSearchQuery] = useState("");
  const [selectedColorForStockIn, setSelectedColorForStockIn] = useState<ColorWithVariantAndProduct | null>(null);

  /* -------------------------
     Queries
     ------------------------- */
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: variantsData = [], isLoading: variantsLoading } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
  });

  const { data: colorsData = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  /* Useful derived lists */
  const companies = useMemo(() => {
    const unique = [...new Set(products.map(p => p.company))];
    return unique.sort();
  }, [products]);

  const productsByCompany = useMemo(() => {
    if (!selectedCompany) return [];
    return products.filter(p => p.company === selectedCompany).map(p => p.productName).sort();
  }, [products, selectedCompany]);

  /* -------------------------
     Forms
     ------------------------- */
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

  /* -------------------------
     Quick Add auto-append empty rows
     ------------------------- */
  useEffect(() => {
    const last = quickVariants[quickVariants.length - 1];
    if (last && (last.packingSize.trim() !== "" || last.rate.trim() !== "")) {
      setQuickVariants(prev => [...prev, { id: String(Date.now()), packingSize: "", rate: "" }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickVariants.length]);

  useEffect(() => {
    const last = quickColors[quickColors.length - 1];
    if (last && (last.colorName.trim() !== "" || last.colorCode.trim() !== "" || last.stockQuantity.trim() !== "")) {
      setQuickColors(prev => [...prev, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "" }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickColors.length]);

  /* -------------------------
     Mutations
     ------------------------- */
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
      const res = await apiRequest("POST", "/api/variants", { ...data, rate: parseFloat(data.rate) });
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
      const res = await apiRequest("POST", "/api/colors", { ...data, stockQuantity: parseInt(data.stockQuantity, 10) });
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

  /* Quick Add bulk mutations (used by wizard) */
  const createProductMutation = useMutation({
    mutationFn: async (data: { company: string; productName: string }) => {
      const res = await apiRequest("POST", "/api/products", data);
      return await res.json();
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: async (data: { productId: string; packingSize: string; rate: number }) => {
      const res = await apiRequest("POST", "/api/variants", data);
      return await res.json();
    },
  });

  const createColorMutation = useMutation({
    mutationFn: async (data: { variantId: string; colorName: string; colorCode: string; stockQuantity: number }) => {
      const res = await apiRequest("POST", "/api/colors", data);
      return await res.json();
    },
  });

  /* Stock In mutation */
  const stockInMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stockInFormSchema>) => {
      const res = await apiRequest("POST", `/api/colors/${data.colorId}/stock-in`, { quantity: parseInt(data.quantity, 10) });
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

  /* -------------------------
     Helpers + UI functions
     ------------------------- */
  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (stock < 10) return <Badge variant="secondary">Low Stock</Badge>;
    return <Badge variant="default">In Stock</Badge>;
  };

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

  /* Quick Add UI helpers */
  const updateVariant = (index: number, key: keyof QuickVariant, value: string) => {
    setQuickVariants(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [key]: value };
      return clone;
    });
  };

  const removeVariantAt = (index: number) => {
    setQuickVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateColor = (index: number, key: keyof QuickColor, value: string) => {
    setQuickColors(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [key]: value };
      return clone;
    });
  };

  const removeColorAt = (index: number) => {
    setQuickColors(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSection = (section: "variants" | "colors") => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  /* -------------------------
     Quick Add final save
     ------------------------- */
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  const saveQuickAdd = async () => {
    // Determine final company & product
    const company = useExistingCompany ? selectedCompany : newCompany.trim();
    const productName = useExistingProduct ? selectedProduct : newProduct.trim();

    // Basic validations
    if (!company) {
      toast({ title: "Company is required", variant: "destructive" });
      setQuickStep(1);
      return;
    }
    if (!productName) {
      toast({ title: "Product name is required", variant: "destructive" });
      setQuickStep(1);
      return;
    }

    const finalVariants = quickVariants
      .filter(v => v.packingSize.trim() !== "" && v.rate.trim() !== "")
      .map(v => ({ packingSize: v.packingSize.trim(), rate: v.rate.trim() }));

    if (finalVariants.length === 0) {
      toast({ title: "Add at least one variant", variant: "destructive" });
      setQuickStep(2);
      return;
    }

    const finalColors = quickColors
      .filter(c => c.colorName.trim() !== "" && c.colorCode.trim() !== "" && c.stockQuantity.trim() !== "")
      .map(c => ({ colorName: c.colorName.trim(), colorCode: c.colorCode.trim(), stockQuantity: c.stockQuantity.trim() }));

    setIsSavingQuick(true);
    try {
      // Check existing product
      let productId: string | undefined;
      const existingProduct = products.find(p => p.company === company && p.productName === productName);
      if (existingProduct) {
        productId = existingProduct.id;
      } else {
        const resp = await createProductMutation.mutateAsync({ company, productName });
        productId = resp?.id;
      }

      if (!productId) throw new Error("Product creation failed: no id returned");

      // Create variants and capture ids
      const createdVariantIds: string[] = [];
      for (const variant of finalVariants) {
        const vResp = await createVariantMutation.mutateAsync({ productId, packingSize: variant.packingSize, rate: parseFloat(variant.rate) });
        createdVariantIds.push(vResp.id);
      }

      // Create colors for each created variant
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
        description: `Product "${productName}" with ${finalVariants.length} variants and ${finalColors.length} colors added successfully.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/colors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });

      // Reset wizard
      setIsQuickAddOpen(false);
      setQuickStep(1);
      setSelectedCompany("");
      setSelectedProduct("");
      setNewCompany("");
      setNewProduct("");
      setUseExistingCompany(true);
      setUseExistingProduct(true);
      setQuickVariants([{ id: `${Date.now()}-v0`, packingSize: "", rate: "" }]);
      setQuickColors([{ id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" }]);
    } catch (err: any) {
      console.error("Quick Add save error:", err);
      toast({ title: "Save failed", description: err?.message || "Unknown error occurred", variant: "destructive" });
    } finally {
      setIsSavingQuick(false);
    }
  };

  /* -------------------------
     Render
     ------------------------- */
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Management</h1>
          <p className="text-sm text-muted-foreground">Manage products, variants, colors, and stock</p>
        </div>

        {/* Quick Add Button */}
        <div>
          <Dialog open={isQuickAddOpen} onOpenChange={(open) => {
            setIsQuickAddOpen(open);
            if (!open) {
              // reset wizard on close
              setQuickStep(1);
              setSelectedCompany("");
              setSelectedProduct("");
              setNewCompany("");
              setNewProduct("");
              setUseExistingCompany(true);
              setUseExistingProduct(true);
              setQuickVariants([{ id: `${Date.now()}-v0`, packingSize: "", rate: "" }]);
              setQuickColors([{ id: `${Date.now()}-c0`, colorName: "", colorCode: "", stockQuantity: "" }]);
            }
          }}>
            <Button onClick={() => setIsQuickAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Quick Add Product
            </Button>

            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Quick Add Product</DialogTitle>
                <DialogDescription>Add complete product with variants and colors</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Progress indicator */}
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded ${quickStep === 1 ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>1. Product</div>
                  <div className={`px-3 py-1 rounded ${quickStep === 2 ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>2. Variants</div>
                  <div className={`px-3 py-1 rounded ${quickStep === 3 ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>3. Colors</div>
                </div>

                {/* Step 1: Product */}
                {quickStep === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Company</Label>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="existing-company" checked={useExistingCompany} onChange={() => setUseExistingCompany(true)} className="h-4 w-4" />
                          <Label htmlFor="existing-company" className="text-sm">Select Existing</Label>
                          <input type="radio" id="new-company" checked={!useExistingCompany} onChange={() => setUseExistingCompany(false)} className="h-4 w-4" />
                          <Label htmlFor="new-company" className="text-sm">Add New</Label>
                        </div>
                      </div>

                      {useExistingCompany ? (
                        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map(company => <SelectItem key={company} value={company}>{company}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Enter new company name" />
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Product</Label>
                        <div className="flex items-center space-x-2">
                          <input type="radio" id="existing-product" checked={useExistingProduct} onChange={() => setUseExistingProduct(true)} className="h-4 w-4" disabled={!selectedCompany && useExistingCompany} />
                          <Label htmlFor="existing-product" className="text-sm">Select Existing</Label>
                          <input type="radio" id="new-product" checked={!useExistingProduct} onChange={() => setUseExistingProduct(false)} className="h-4 w-4" />
                          <Label htmlFor="new-product" className="text-sm">Add New</Label>
                        </div>
                      </div>

                      {useExistingProduct ? (
                        <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!selectedCompany}>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedCompany ? "Select product" : "Select company first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {productsByCompany.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={newProduct} onChange={e => setNewProduct(e.target.value)} placeholder="Enter new product name" />
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                      <Button onClick={() => setQuickStep(2)} disabled={
                        !(useExistingCompany ? selectedCompany : newCompany.trim()) ||
                        !(useExistingProduct ? selectedProduct : newProduct.trim())
                      }>
                        Continue to Variants →
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 2: Variants */}
                {quickStep === 2 && (
                  <div className="space-y-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("variants")}>
                        <h3 className="font-semibold text-lg">Variants</h3>
                        <Button variant="ghost" size="sm">{expandedSections.variants ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                      </div>

                      {expandedSections.variants && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-3">
                            {quickVariants.map((variant, index) => (
                              <div key={variant.id} className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-5">
                                  <Input placeholder="Packing size (e.g., 1L, 4L, 16L)" value={variant.packingSize} onChange={e => updateVariant(index, "packingSize", e.target.value)} />
                                </div>
                                <div className="col-span-5">
                                  <Input type="number" step="0.01" placeholder="Rate (Rs.)" value={variant.rate} onChange={e => updateVariant(index, "rate", e.target.value)} />
                                </div>
                                <div className="col-span-2">
                                  <Button variant="ghost" size="sm" onClick={() => removeVariantAt(index)} disabled={quickVariants.length === 1}><Trash className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button size="sm" variant="outline" onClick={() => setQuickVariants(p => [...p, { id: String(Date.now()), packingSize: "", rate: "" }])}><Plus className="mr-2 h-4 w-4" /> Add Variant</Button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="ghost" onClick={() => setQuickStep(1)}>← Back</Button>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                        <Button onClick={() => setQuickStep(3)} disabled={quickVariants.filter(v => v.packingSize.trim() !== "" && v.rate.trim() !== "").length === 0}>Continue to Colors →</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Colors */}
                {quickStep === 3 && (
                  <div className="space-y-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection("colors")}>
                        <h3 className="font-semibold text-lg">Colors</h3>
                        <Button variant="ghost" size="sm">{expandedSections.colors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                      </div>

                      {expandedSections.colors && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-3">
                            {quickColors.map((color, index) => (
                              <div key={color.id} className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-4">
                                  <Input placeholder="Color name" value={color.colorName} onChange={e => updateColor(index, "colorName", e.target.value)} />
                                </div>
                                <div className="col-span-4">
                                  <Input placeholder="Color code" value={color.colorCode} onChange={e => updateColor(index, "colorCode", e.target.value)} />
                                </div>
                                <div className="col-span-3">
                                  <Input type="number" min="0" placeholder="Quantity" value={color.stockQuantity} onChange={e => updateColor(index, "stockQuantity", e.target.value)} />
                                </div>
                                <div className="col-span-1">
                                  <Button variant="ghost" size="sm" onClick={() => removeColorAt(index)} disabled={quickColors.length === 1}><Trash className="h-4 w-4" /></Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button size="sm" variant="outline" onClick={() => setQuickColors(p => [...p, { id: String(Date.now()), colorName: "", colorCode: "", stockQuantity: "" }])}><Plus className="mr-2 h-4 w-4" /> Add Color</Button>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button variant="ghost" onClick={() => setQuickStep(2)}>← Back</Button>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                        <Button onClick={saveQuickAdd} disabled={isSavingQuick}>{isSavingQuick ? "Saving..." : "Save Product"}</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs: Quick Add + Products/Variants/Colors/Stock In */}
      <Tabs defaultValue="quick-add" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quick-add"><Plus className="mr-2 h-4 w-4" /> Quick Add</TabsTrigger>
          <TabsTrigger value="products"><Package className="mr-2 h-4 w-4" /> Products</TabsTrigger>
          <TabsTrigger value="variants"><Layers className="mr-2 h-4 w-4" /> Variants</TabsTrigger>
          <TabsTrigger value="colors"><Palette className="mr-2 h-4 w-4" /> Colors</TabsTrigger>
          <TabsTrigger value="stock-in"><TruckIcon className="mr-2 h-4 w-4" /> Stock In</TabsTrigger>
        </TabsList>

        {/* Quick Add Tab (summary) */}
        <TabsContent value="quick-add" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between gap-4">
              <CardTitle>Quick Add — All-in-One Wizard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Quickly add full product + variants + colors in one flow. Click the Quick Add button above to start the wizard.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Package className="h-8 w-8 mx-auto text-blue-500" />
                    <h3 className="font-semibold">Products</h3>
                    <p className="text-2xl font-bold text-blue-600">{products.length}</p>
                  </div>
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Layers className="h-8 w-8 mx-auto text-green-500" />
                    <h3 className="font-semibold">Variants</h3>
                    <p className="text-2xl font-bold text-green-600">{variantsData.length}</p>
                  </div>
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Palette className="h-8 w-8 mx-auto text-purple-500" />
                    <h3 className="font-semibold">Colors</h3>
                    <p className="text-2xl font-bold text-purple-600">{colorsData.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Products ({products.length})</CardTitle>
              <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                <Button onClick={() => setIsProductDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>Add company and product name</DialogDescription>
                  </DialogHeader>
                  <Form {...productForm}>
                    <form onSubmit={productForm.handleSubmit((data) => createProductSingleMutation.mutate(data))} className="space-y-4">
                      <FormField control={productForm.control} name="company" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl><Input placeholder="e.g., Premium Paint Co" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={productForm.control} name="productName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name</FormLabel>
                          <FormControl><Input placeholder="e.g., Exterior Emulsion" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createProductSingleMutation.isPending}>{createProductSingleMutation.isPending ? "Creating..." : "Create Product"}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No products found. Add your first product to get started.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Variants</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(product => {
                      const productVariants = variantsData.filter(v => v.productId === product.id);
                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.company}</TableCell>
                          <TableCell>{product.productName}</TableCell>
                          <TableCell><Badge variant="outline">{productVariants.length} variants</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{new Date(product.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Variants Tab */}
        <TabsContent value="variants" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Variants ({variantsData.length})</CardTitle>
              <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
                <Button onClick={() => setIsVariantDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Variant</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Variant</DialogTitle>
                    <DialogDescription>Select product, packing size, and rate</DialogDescription>
                  </DialogHeader>
                  <Form {...variantForm}>
                    <form onSubmit={variantForm.handleSubmit((data) => createVariantSingleMutation.mutate(data))} className="space-y-4">
                      <FormField control={variantForm.control} name="productId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.company} - {p.productName}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={variantForm.control} name="packingSize" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Packing Size</FormLabel>
                          <FormControl><Input placeholder="e.g., 1L, 4L, 16L" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={variantForm.control} name="rate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rate (Rs.)</FormLabel>
                          <FormControl><Input type="number" step="0.01" placeholder="e.g., 250.00" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsVariantDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createVariantSingleMutation.isPending}>{createVariantSingleMutation.isPending ? "Creating..." : "Create Variant"}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {variantsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : variantsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No variants found. Add a product first, then create variants.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Packing Size</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Colors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variantsData.map(variant => {
                      const variantColors = colorsData.filter(c => c.variantId === variant.id);
                      return (
                        <TableRow key={variant.id}>
                          <TableCell className="font-medium">{variant.product.company}</TableCell>
                          <TableCell>{variant.product.productName}</TableCell>
                          <TableCell>{variant.packingSize}</TableCell>
                          <TableCell>Rs. {Math.round(parseFloat(variant.rate))}</TableCell>
                          <TableCell><Badge variant="outline">{variantColors.length} colors</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Colors & Inventory ({colorsData.length})</CardTitle>
              <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
                <Button onClick={() => setIsColorDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Color</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Color</DialogTitle>
                    <DialogDescription>Select variant and add color details with quantity</DialogDescription>
                  </DialogHeader>
                  <Form {...colorForm}>
                    <form onSubmit={colorForm.handleSubmit((data) => createColorSingleMutation.mutate(data))} className="space-y-4">
                      <FormField control={colorForm.control} name="variantId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Variant (Product + Size)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {variantsData.map(v => <SelectItem key={v.id} value={v.id}>{v.product.company} - {v.product.productName} ({v.packingSize})</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={colorForm.control} name="colorName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Name</FormLabel>
                          <FormControl><Input placeholder="e.g., Sky Blue" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={colorForm.control} name="colorCode" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Code</FormLabel>
                          <FormControl><Input placeholder="e.g., RAL 5002" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={colorForm.control} name="stockQuantity" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl><Input type="number" min="0" placeholder="e.g., 50" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsColorDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={createColorSingleMutation.isPending}>{createColorSingleMutation.isPending ? "Adding..." : "Add Color"}</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent className="space-y-4">
              {!colorsLoading && colorsData.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by color code, name, product, company..." value={colorSearchQuery} onChange={e => setColorSearchQuery(e.target.value)} className="pl-9" />
                </div>
              )}

              {colorsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : colorsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No colors found. Add a variant first, then add colors with inventory.</div>
              ) : filteredColors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No colors found matching "{colorSearchQuery}"</div>
              ) : (
                <div className="space-y-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Color Name</TableHead>
                        <TableHead>Color Code</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredColors.map(color => (
                        <TableRow key={color.id}>
                          <TableCell className="font-medium">{color.variant.product.company}</TableCell>
                          <TableCell>{color.variant.product.productName}</TableCell>
                          <TableCell>{color.variant.packingSize}</TableCell>
                          <TableCell>{color.colorName}</TableCell>
                          <TableCell><Badge variant="outline">{color.colorCode}</Badge></TableCell>
                          <TableCell>{color.stockQuantity}</TableCell>
                          <TableCell>{getStockBadge(color.stockQuantity)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {colorSearchQuery && <p className="text-xs text-muted-foreground text-center">Showing {filteredColors.length} of {colorsData.length} colors</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock In Tab */}
        <TabsContent value="stock-in" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock In</CardTitle>
              <p className="text-sm text-muted-foreground">Search and add inventory to existing colors</p>
            </CardHeader>
            <CardContent>
              {colorsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : colorsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No colors found. Add colors first before using stock in.</div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by color code, name, company, or product..." value={stockInSearchQuery} onChange={e => setStockInSearchQuery(e.target.value)} className="pl-10" />
                  </div>

                  {filteredColorsForStockIn.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No colors found matching your search.</div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredColorsForStockIn.map(color => (
                        <Card key={color.id} className="hover-elevate" >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="font-mono font-semibold">{color.colorCode}</Badge>
                                  <span className="text-sm font-medium truncate">{color.colorName}</span>
                                  {getStockBadge(color.stockQuantity)}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {color.variant.product.company} - {color.variant.product.productName} ({color.variant.packingSize})
                                </p>
                                <p className="text-xs font-mono text-muted-foreground">
                                  Current Stock: <span className="font-semibold text-foreground">{color.stockQuantity}</span>
                                </p>
                              </div>
                              <Button size="sm" onClick={() => {
                                stockInForm.setValue("colorId", color.id);
                                stockInForm.setValue("quantity", "");
                                setSelectedColorForStockIn(color);
                                setIsStockInDialogOpen(true);
                              }}>
                                <Plus className="h-4 w-4 mr-1" /> Add
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {stockInSearchQuery && filteredColorsForStockIn.length > 0 && <p className="text-xs text-muted-foreground text-center">Showing {filteredColorsForStockIn.length} of {colorsData.length} colors</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock In Dialog */}
          <Dialog open={isStockInDialogOpen} onOpenChange={(open) => {
            setIsStockInDialogOpen(open);
            if (!open) {
              setSelectedColorForStockIn(null);
              setStockInSearchQuery("");
              stockInForm.reset();
            }
          }}>
            <DialogContent className="max-w-3xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>Add Stock</DialogTitle>
                <DialogDescription>Add quantity to inventory</DialogDescription>
              </DialogHeader>

              {!selectedColorForStockIn ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by color code, name, product, or company..." value={stockInSearchQuery} onChange={e => setStockInSearchQuery(e.target.value)} className="pl-10" />
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto space-y-2">
                    {filteredColorsForStockIn.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{stockInSearchQuery ? "No colors found matching your search" : "No colors available"}</p>
                      </div>
                    ) : (
                      filteredColorsForStockIn.map(color => (
                        <Card key={color.id} className="hover-elevate cursor-pointer" onClick={() => {
                          setSelectedColorForStockIn(color);
                          stockInForm.setValue("colorId", color.id);
                        }}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold font-mono text-sm">{color.colorCode}</span>
                                  <Badge variant="outline" className="text-xs">Stock: {color.stockQuantity}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{color.colorName}</p>
                                <p className="text-xs text-muted-foreground">{color.variant.product.company} - {color.variant.product.productName} ({color.variant.packingSize})</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  {stockInSearchQuery && filteredColorsForStockIn.length > 0 && <p className="text-xs text-muted-foreground text-center">Showing {filteredColorsForStockIn.length} of {colorsData.length} colors</p>}
                </div>
              ) : (
                <Form {...stockInForm}>
                  <form onSubmit={stockInForm.handleSubmit((data) => stockInMutation.mutate(data))} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selected Color</Label>
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold font-mono text-sm">{selectedColorForStockIn.colorCode}</span>
                                <Badge variant="outline" className="text-xs">Current Stock: {selectedColorForStockIn.stockQuantity}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{selectedColorForStockIn.colorName}</p>
                              <p className="text-xs text-muted-foreground">{selectedColorForStockIn.variant.product.company} - {selectedColorForStockIn.variant.product.productName} ({selectedColorForStockIn.variant.packingSize})</p>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedColorForStockIn(null)}>Change</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <FormField control={stockInForm.control} name="quantity" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity to Add</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" step="1" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => {
                        setSelectedColorForStockIn(null);
                        setStockInSearchQuery("");
                        stockInForm.reset();
                      }}>Cancel</Button>
                      <Button type="submit" disabled={stockInMutation.isPending}>{stockInMutation.isPending ? "Adding..." : "Add Stock"}</Button>
                    </div>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
