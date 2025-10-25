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
import { Plus, Package, Palette, Layers, TruckIcon, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, VariantWithProduct, ColorWithVariantAndProduct } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function StockManagement() {
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [isColorDialogOpen, setIsColorDialogOpen] = useState(false);
  const [isStockInDialogOpen, setIsStockInDialogOpen] = useState(false);
  const [colorSearchQuery, setColorSearchQuery] = useState("");
  const [stockInSearchQuery, setStockInSearchQuery] = useState("");
  const [selectedColorForStockIn, setSelectedColorForStockIn] = useState<ColorWithVariantAndProduct | null>(null);
  const { toast } = useToast();

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: variants = [], isLoading: variantsLoading } = useQuery<VariantWithProduct[]>({
    queryKey: ["/api/variants"],
  });

  const { data: colors = [], isLoading: colorsLoading } = useQuery<ColorWithVariantAndProduct[]>({
    queryKey: ["/api/colors"],
  });

  const filteredColors = useMemo(() => {
    const query = colorSearchQuery.toLowerCase().trim();
    if (!query) return colors;
    
    return colors
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
  }, [colors, colorSearchQuery]);

  const filteredColorsForStockIn = useMemo(() => {
    const query = stockInSearchQuery.toLowerCase().trim();
    if (!query) return colors;
    
    return colors
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
  }, [colors, stockInSearchQuery]);

  const productForm = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      company: "",
      productName: "",
    },
  });

  const variantForm = useForm<z.infer<typeof variantFormSchema>>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: {
      productId: "",
      packingSize: "",
      rate: "",
    },
  });

  const colorForm = useForm<z.infer<typeof colorFormSchema>>({
    resolver: zodResolver(colorFormSchema),
    defaultValues: {
      variantId: "",
      colorName: "",
      colorCode: "",
      stockQuantity: "",
    },
  });

  const stockInForm = useForm<z.infer<typeof stockInFormSchema>>({
    resolver: zodResolver(stockInFormSchema),
    defaultValues: {
      colorId: "",
      quantity: "",
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      return await apiRequest("POST", "/api/products", data);
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

  const createVariantMutation = useMutation({
    mutationFn: async (data: z.infer<typeof variantFormSchema>) => {
      return await apiRequest("POST", "/api/variants", {
        ...data,
        rate: parseFloat(data.rate),
      });
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

  const createColorMutation = useMutation({
    mutationFn: async (data: z.infer<typeof colorFormSchema>) => {
      return await apiRequest("POST", "/api/colors", {
        ...data,
        stockQuantity: parseInt(data.stockQuantity),
      });
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

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive" data-testid="badge-out-of-stock">Out of Stock</Badge>;
    if (stock < 10) return <Badge variant="secondary" data-testid="badge-low-stock">Low Stock</Badge>;
    return <Badge variant="default" data-testid="badge-in-stock">In Stock</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-stock-title">Stock Management</h1>
          <p className="text-sm text-muted-foreground">Manage products, variants, and colors</p>
        </div>
      </div>

      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="mr-2 h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="variants" data-testid="tab-variants">
            <Layers className="mr-2 h-4 w-4" />
            Variants
          </TabsTrigger>
          <TabsTrigger value="colors" data-testid="tab-colors">
            <Palette className="mr-2 h-4 w-4" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="stock-in" data-testid="tab-stock-in">
            <TruckIcon className="mr-2 h-4 w-4" />
            Stock In
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Products</CardTitle>
              <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                <Button onClick={() => setIsProductDialogOpen(true)} data-testid="button-add-product">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                    <DialogDescription>Add company name and product name</DialogDescription>
                  </DialogHeader>
                  <Form {...productForm}>
                    <form
                      onSubmit={productForm.handleSubmit((data) => createProductMutation.mutate(data))}
                      className="space-y-4"
                    >
                      <FormField
                        control={productForm.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Premium Paint Co" {...field} data-testid="input-product-company" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={productForm.control}
                        name="productName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Exterior Emulsion" {...field} data-testid="input-product-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)} data-testid="button-cancel-product">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createProductMutation.isPending} data-testid="button-submit-product">
                          {createProductMutation.isPending ? "Creating..." : "Create Product"}
                        </Button>
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
                <div className="text-center py-8 text-muted-foreground">
                  No products found. Add your first product to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                        <TableCell className="font-medium">{product.company}</TableCell>
                        <TableCell>{product.productName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(product.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
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
              <CardTitle>Variants</CardTitle>
              <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
                <Button onClick={() => setIsVariantDialogOpen(true)} data-testid="button-add-variant">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variant
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Variant</DialogTitle>
                    <DialogDescription>Select product, packing size, and rate</DialogDescription>
                  </DialogHeader>
                  <Form {...variantForm}>
                    <form
                      onSubmit={variantForm.handleSubmit((data) => createVariantMutation.mutate(data))}
                      className="space-y-4"
                    >
                      <FormField
                        control={variantForm.control}
                        name="productId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-variant-product">
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.company} - {product.productName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={variantForm.control}
                        name="packingSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Packing Size</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 1L, 4L, 16L" {...field} data-testid="input-variant-packing" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={variantForm.control}
                        name="rate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate (Rs. )</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="e.g., 250.00" {...field} data-testid="input-variant-rate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsVariantDialogOpen(false)} data-testid="button-cancel-variant">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createVariantMutation.isPending} data-testid="button-submit-variant">
                          {createVariantMutation.isPending ? "Creating..." : "Create Variant"}
                        </Button>
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
              ) : variants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No variants found. Add a product first, then create variants.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Packing Size</TableHead>
                      <TableHead>Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((variant) => (
                      <TableRow key={variant.id} data-testid={`row-variant-${variant.id}`}>
                        <TableCell className="font-medium">{variant.product.company}</TableCell>
                        <TableCell>{variant.product.productName}</TableCell>
                        <TableCell>{variant.packingSize}</TableCell>
                        <TableCell>Rs. {Math.round(parseFloat(variant.rate))}</TableCell>
                      </TableRow>
                    ))}
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
              <CardTitle>Colors & Inventory</CardTitle>
              <Dialog open={isColorDialogOpen} onOpenChange={setIsColorDialogOpen}>
                <Button onClick={() => setIsColorDialogOpen(true)} data-testid="button-add-color">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Color
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Color</DialogTitle>
                    <DialogDescription>Select variant and add color details with quantity</DialogDescription>
                  </DialogHeader>
                  <Form {...colorForm}>
                    <form
                      onSubmit={colorForm.handleSubmit((data) => createColorMutation.mutate(data))}
                      className="space-y-4"
                    >
                      <FormField
                        control={colorForm.control}
                        name="variantId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Variant (Product + Size)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-color-variant">
                                  <SelectValue placeholder="Select variant" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {variants.map((variant) => (
                                  <SelectItem key={variant.id} value={variant.id}>
                                    {variant.product.company} - {variant.product.productName} ({variant.packingSize})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={colorForm.control}
                        name="colorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Sky Blue, Sunset Red" {...field} data-testid="input-color-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={colorForm.control}
                        name="colorCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color Code</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., RAL 9003, RAL 5002" {...field} data-testid="input-color-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={colorForm.control}
                        name="stockQuantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" placeholder="e.g., 50" {...field} data-testid="input-color-quantity" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsColorDialogOpen(false)} data-testid="button-cancel-color">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createColorMutation.isPending} data-testid="button-submit-color">
                          {createColorMutation.isPending ? "Adding..." : "Add Color"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {!colorsLoading && colors.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by color code, name, product, company... (exact code match priority)"
                    value={colorSearchQuery}
                    onChange={(e) => setColorSearchQuery(e.target.value)}
                    data-testid="input-search-colors"
                    className="pl-9"
                  />
                </div>
              )}
              {colorsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : colors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No colors found. Add a variant first, then add colors with inventory.
                </div>
              ) : filteredColors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No colors found matching "{colorSearchQuery}"
                </div>
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
                    {filteredColors.map((color) => (
                      <TableRow key={color.id} data-testid={`row-color-${color.id}`}>
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
                {colorSearchQuery && (
                  <p className="text-xs text-muted-foreground text-center">
                    Showing {filteredColors.length} of {colors.length} colors
                  </p>
                )}
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
              ) : colors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No colors found. Add colors first before using stock in.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by color code, name, company, or product..."
                      value={colorSearchQuery}
                      onChange={(e) => setColorSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-stock-in-search"
                    />
                  </div>
                  
                  {filteredColors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No colors found matching your search.
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredColors.map((color) => (
                        <Card key={color.id} className="hover-elevate" data-testid={`card-stock-in-${color.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="font-mono font-semibold">
                                    {color.colorCode}
                                  </Badge>
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
                              <Button
                                size="sm"
                                onClick={() => {
                                  stockInForm.setValue("colorId", color.id);
                                  stockInForm.setValue("quantity", "");
                                  setIsStockInDialogOpen(true);
                                }}
                                data-testid={`button-add-stock-${color.id}`}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {colorSearchQuery && filteredColors.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing {filteredColors.length} of {colors.length} colors
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock In Dialog */}
          <Dialog 
            open={isStockInDialogOpen} 
            onOpenChange={(open) => {
              setIsStockInDialogOpen(open);
              if (!open) {
                setSelectedColorForStockIn(null);
                setStockInSearchQuery("");
                stockInForm.reset();
              }
            }}
          >
            <DialogContent className="max-w-3xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle>Add Stock</DialogTitle>
                <DialogDescription>Add quantity to inventory</DialogDescription>
              </DialogHeader>

              {!selectedColorForStockIn ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by color code, name, product, or company..."
                      value={stockInSearchQuery}
                      onChange={(e) => setStockInSearchQuery(e.target.value)}
                      data-testid="input-stock-in-search"
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto space-y-2">
                    {filteredColorsForStockIn.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{stockInSearchQuery ? "No colors found matching your search" : "No colors available"}</p>
                      </div>
                    ) : (
                      filteredColorsForStockIn.map((color) => (
                        <Card
                          key={color.id}
                          className="hover-elevate cursor-pointer"
                          onClick={() => {
                            setSelectedColorForStockIn(color);
                            stockInForm.setValue("colorId", color.id);
                          }}
                          data-testid={`card-stock-in-color-${color.id}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold font-mono text-sm">{color.colorCode}</span>
                                  <Badge variant="outline" className="text-xs">Stock: {color.stockQuantity}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{color.colorName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {color.variant.product.company} - {color.variant.product.productName} ({color.variant.packingSize})
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  {stockInSearchQuery && filteredColorsForStockIn.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Showing {filteredColorsForStockIn.length} of {colors.length} colors
                    </p>
                  )}
                </div>
              ) : (
                <Form {...stockInForm}>
                  <form
                    onSubmit={stockInForm.handleSubmit((data) => stockInMutation.mutate(data))}
                    className="space-y-4"
                  >
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
                              <p className="text-xs text-muted-foreground">
                                {selectedColorForStockIn.variant.product.company} - {selectedColorForStockIn.variant.product.productName} ({selectedColorForStockIn.variant.packingSize})
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedColorForStockIn(null)}
                              data-testid="button-change-color"
                            >
                              Change
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <FormField
                      control={stockInForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity to Add</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" step="1" placeholder="0" {...field} data-testid="input-stock-in-quantity" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setSelectedColorForStockIn(null);
                          setStockInSearchQuery("");
                          stockInForm.reset();
                        }}
                        data-testid="button-cancel-stock-in"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={stockInMutation.isPending} data-testid="button-submit-stock-in">
                        {stockInMutation.isPending ? "Adding..." : "Add Stock"}
                      </Button>
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
