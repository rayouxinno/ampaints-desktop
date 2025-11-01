import {
  products,
  variants,
  colors,
  sales,
  saleItems,
  type Product,
  type InsertProduct,
  type Variant,
  type InsertVariant,
  type Color,
  type InsertColor,
  type Sale,
  type InsertSale,
  type SaleItem,
  type InsertSaleItem,
  type VariantWithProduct,
  type ColorWithVariantAndProduct,
  type SaleWithItems,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, sql, and, like, or, sum, lt, ne } from "drizzle-orm";

export interface IStorage {
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: InsertProduct): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  // Variants
  getVariants(): Promise<VariantWithProduct[]>;
  getVariant(id: string): Promise<Variant | undefined>;
  createVariant(variant: InsertVariant): Promise<Variant>;
  updateVariant(id: string, variant: InsertVariant): Promise<Variant>;
  updateVariantRate(id: string, rate: number): Promise<Variant>;
  deleteVariant(id: string): Promise<void>;

  // Colors
  getColors(): Promise<ColorWithVariantAndProduct[]>;
  getColor(id: string): Promise<Color | undefined>;
  createColor(color: InsertColor): Promise<Color>;
  updateColor(id: string, color: InsertColor): Promise<Color>;
  updateColorStock(id: string, stockQuantity: number): Promise<Color>;
  stockIn(id: string, quantity: number): Promise<Color>;
  deleteColor(id: string): Promise<void>;

  // Sales
  getSales(): Promise<Sale[]>;
  getRecentSales(limit?: number): Promise<Sale[]>;
  getUnpaidSales(): Promise<Sale[]>;
  findUnpaidSaleByPhone(customerPhone: string): Promise<Sale | undefined>;
  getSale(id: string): Promise<SaleWithItems | undefined>;
  createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  updateSalePayment(saleId: string, amount: number): Promise<Sale>;
  addSaleItem(saleId: string, item: InsertSaleItem): Promise<SaleItem>;
  deleteSaleItem(saleItemId: string): Promise<void>;
  returnSaleItem(saleItemId: string, quantity: number, reason: string): Promise<{ success: boolean }>;
  deleteSale(saleId: string): Promise<void>;

  // Customer Management
  getCustomerSuggestions(limit?: number): Promise<any[]>;
  searchCustomers(query: string): Promise<any[]>;
  getCustomerBills(phone: string): Promise<Sale[]>;

  // Reports
  getSalesReport(params: { startDate?: string; endDate?: string; groupBy?: string }): Promise<any>;
  getInventoryReport(lowStockThreshold?: number): Promise<any>;
  getCustomerDebtReport(): Promise<any>;

  // Search
  searchProducts(params: { query?: string; company?: string; category?: string }): Promise<any[]>;
  searchColors(params: { query?: string; company?: string; product?: string; variant?: string }): Promise<any[]>;

  // Bulk Operations
  bulkStockIn(items: any[]): Promise<any[]>;
  bulkUpdateRates(updates: any[]): Promise<any[]>;

  // Export/Import
  exportData(type?: string): Promise<any>;
  importData(data: any, type: string): Promise<{ success: boolean }>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    todaySales: { revenue: number; transactions: number };
    monthlySales: { revenue: number; transactions: number };
    inventory: { totalProducts: number; totalVariants: number; totalColors: number; lowStock: number; totalStockValue: number };
    unpaidBills: { count: number; totalAmount: number };
    recentSales: Sale[];
    monthlyChart: { date: string; revenue: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // Products
  async getProducts(): Promise<Product[]> {
    try {
      const result = await db.select().from(products).orderBy(desc(products.createdAt));
      return result || [];
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  }

  async getProduct(id: string): Promise<Product | undefined> {
    try {
      const [product] = await db.select().from(products).where(eq(products.id, id));
      return product || undefined;
    } catch (error) {
      console.error("Error fetching product:", error);
      return undefined;
    }
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const product: Product = {
      id: crypto.randomUUID(),
      ...insertProduct,
      createdAt: new Date(),
    };
    await db.insert(products).values(product);
    return product;
  }

  async updateProduct(id: string, insertProduct: InsertProduct): Promise<Product> {
    await db
      .update(products)
      .set(insertProduct)
      .where(eq(products.id, id));
    
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) throw new Error("Product not found");
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Variants
  async getVariants(): Promise<VariantWithProduct[]> {
    try {
      const result = await db.query.variants.findMany({
        with: {
          product: true,
        },
        orderBy: desc(variants.createdAt),
      });
      return result || [];
    } catch (error) {
      console.error("Error fetching variants:", error);
      return [];
    }
  }

  async getVariant(id: string): Promise<Variant | undefined> {
    try {
      const [variant] = await db.select().from(variants).where(eq(variants.id, id));
      return variant || undefined;
    } catch (error) {
      console.error("Error fetching variant:", error);
      return undefined;
    }
  }

  async createVariant(insertVariant: InsertVariant): Promise<Variant> {
    const variant: Variant = {
      id: crypto.randomUUID(),
      ...insertVariant,
      rate: typeof insertVariant.rate === 'number' ? insertVariant.rate.toString() : insertVariant.rate,
      createdAt: new Date(),
    };
    await db.insert(variants).values(variant);
    return variant;
  }

  async updateVariant(id: string, insertVariant: InsertVariant): Promise<Variant> {
    await db
      .update(variants)
      .set({
        ...insertVariant,
        rate: typeof insertVariant.rate === 'number' ? insertVariant.rate.toString() : insertVariant.rate,
      })
      .where(eq(variants.id, id));
    
    const [variant] = await db.select().from(variants).where(eq(variants.id, id));
    if (!variant) throw new Error("Variant not found");
    return variant;
  }

  async updateVariantRate(id: string, rate: number): Promise<Variant> {
    await db
      .update(variants)
      .set({ rate: rate.toString() })
      .where(eq(variants.id, id));
    
    const [variant] = await db.select().from(variants).where(eq(variants.id, id));
    if (!variant) throw new Error("Variant not found");
    return variant;
  }

  async deleteVariant(id: string): Promise<void> {
    await db.delete(variants).where(eq(variants.id, id));
  }

  // Colors
  async getColors(): Promise<ColorWithVariantAndProduct[]> {
    try {
      const result = await db.query.colors.findMany({
        with: {
          variant: {
            with: {
              product: true,
            },
          },
        },
        orderBy: desc(colors.createdAt),
      });
      return result || [];
    } catch (error) {
      console.error("Error fetching colors:", error);
      return [];
    }
  }

  async getColor(id: string): Promise<Color | undefined> {
    try {
      const [color] = await db.select().from(colors).where(eq(colors.id, id));
      return color || undefined;
    } catch (error) {
      console.error("Error fetching color:", error);
      return undefined;
    }
  }

  async createColor(insertColor: InsertColor): Promise<Color> {
    const color: Color = {
      id: crypto.randomUUID(),
      ...insertColor,
      createdAt: new Date(),
    };
    await db.insert(colors).values(color);
    return color;
  }

  async updateColor(id: string, insertColor: InsertColor): Promise<Color> {
    await db
      .update(colors)
      .set(insertColor)
      .where(eq(colors.id, id));
    
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    if (!color) throw new Error("Color not found");
    return color;
  }

  async updateColorStock(id: string, stockQuantity: number): Promise<Color> {
    await db
      .update(colors)
      .set({ stockQuantity })
      .where(eq(colors.id, id));
    
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    if (!color) throw new Error("Color not found");
    return color;
  }

  async stockIn(id: string, quantity: number): Promise<Color> {
    await db
      .update(colors)
      .set({
        stockQuantity: sql`${colors.stockQuantity} + ${quantity}`,
      })
      .where(eq(colors.id, id));
    
    const [color] = await db.select().from(colors).where(eq(colors.id, id));
    if (!color) throw new Error("Color not found");
    return color;
  }

  async deleteColor(id: string): Promise<void> {
    await db.delete(colors).where(eq(colors.id, id));
  }

  // Sales
  async getSales(): Promise<Sale[]> {
    try {
      const result = await db.select().from(sales).orderBy(desc(sales.createdAt));
      return result || [];
    } catch (error) {
      console.error("Error fetching sales:", error);
      return [];
    }
  }

  async getRecentSales(limit: number = 10): Promise<Sale[]> {
    try {
      const result = await db
        .select()
        .from(sales)
        .orderBy(desc(sales.createdAt))
        .limit(limit);
      return result || [];
    } catch (error) {
      console.error("Error fetching recent sales:", error);
      return [];
    }
  }

  async getUnpaidSales(): Promise<Sale[]> {
    try {
      const result = await db
        .select()
        .from(sales)
        .where(or(
          eq(sales.paymentStatus, 'unpaid'),
          eq(sales.paymentStatus, 'partial')
        ))
        .orderBy(desc(sales.createdAt));
      return result || [];
    } catch (error) {
      console.error("Error fetching unpaid sales:", error);
      return [];
    }
  }

  async findUnpaidSaleByPhone(customerPhone: string): Promise<Sale | undefined> {
    try {
      const [sale] = await db
        .select()
        .from(sales)
        .where(and(
          eq(sales.customerPhone, customerPhone),
          or(
            eq(sales.paymentStatus, 'unpaid'),
            eq(sales.paymentStatus, 'partial')
          )
        ))
        .orderBy(desc(sales.createdAt))
        .limit(1);
      return sale;
    } catch (error) {
      console.error("Error finding unpaid sale by phone:", error);
      return undefined;
    }
  }

  async getSale(id: string): Promise<SaleWithItems | undefined> {
    try {
      const result = await db.query.sales.findFirst({
        where: eq(sales.id, id),
        with: {
          saleItems: {
            with: {
              color: {
                with: {
                  variant: {
                    with: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      return result || undefined;
    } catch (error) {
      console.error("Error fetching sale:", error);
      return undefined;
    }
  }

  async createSale(insertSale: InsertSale, items: InsertSaleItem[]): Promise<Sale> {
    const sale: Sale = {
      id: crypto.randomUUID(),
      ...insertSale,
      totalAmount: typeof insertSale.totalAmount === 'number' ? insertSale.totalAmount.toString() : insertSale.totalAmount,
      amountPaid: typeof insertSale.amountPaid === 'number' ? insertSale.amountPaid.toString() : insertSale.amountPaid,
      createdAt: new Date(),
    };
    await db.insert(sales).values(sale);

    // Insert sale items
    const saleItemsToInsert = items.map((item) => ({
      id: crypto.randomUUID(),
      ...item,
      saleId: sale.id,
      rate: typeof item.rate === 'number' ? item.rate.toString() : item.rate,
      subtotal: typeof item.subtotal === 'number' ? item.subtotal.toString() : item.subtotal,
    }));
    await db.insert(saleItems).values(saleItemsToInsert);

    // Update stock quantities in colors table
    for (const item of items) {
      await db
        .update(colors)
        .set({
          stockQuantity: sql`${colors.stockQuantity} - ${item.quantity}`,
        })
        .where(eq(colors.id, item.colorId));
    }

    return sale;
  }

  async updateSalePayment(saleId: string, amount: number): Promise<Sale> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    if (!sale) {
      throw new Error("Sale not found");
    }

    const currentPaid = parseFloat(sale.amountPaid);
    const newPaid = currentPaid + amount;
    const total = parseFloat(sale.totalAmount);

    let paymentStatus: string;
    if (newPaid >= total) {
      paymentStatus = "paid";
    } else if (newPaid > 0) {
      paymentStatus = "partial";
    } else {
      paymentStatus = "unpaid";
    }

    await db
      .update(sales)
      .set({
        amountPaid: newPaid.toString(),
        paymentStatus,
      })
      .where(eq(sales.id, saleId));

    const [updatedSale] = await db.select().from(sales).where(eq(sales.id, saleId));
    return updatedSale;
  }

  async addSaleItem(saleId: string, item: InsertSaleItem): Promise<SaleItem> {
    // Add the item to the sale
    const saleItem: SaleItem = {
      id: crypto.randomUUID(),
      ...item,
      saleId,
      rate: typeof item.rate === 'number' ? item.rate.toString() : item.rate,
      subtotal: typeof item.subtotal === 'number' ? item.subtotal.toString() : item.subtotal,
    };
    await db.insert(saleItems).values(saleItem);

    // Update stock for this color
    await db
      .update(colors)
      .set({
        stockQuantity: sql`${colors.stockQuantity} - ${item.quantity}`,
      })
      .where(eq(colors.id, item.colorId));

    // Recalculate sale total
    const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    const newTotal = allItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    const amountPaid = parseFloat(sale.amountPaid);

    let paymentStatus: string;
    if (amountPaid >= newTotal) {
      paymentStatus = "paid";
    } else if (amountPaid > 0) {
      paymentStatus = "partial";
    } else {
      paymentStatus = "unpaid";
    }

    await db
      .update(sales)
      .set({
        totalAmount: newTotal.toString(),
        paymentStatus,
      })
      .where(eq(sales.id, saleId));

    return saleItem;
  }

  async deleteSaleItem(saleItemId: string): Promise<void> {
    // Get the item details before deleting
    const [item] = await db.select().from(saleItems).where(eq(saleItems.id, saleItemId));
    if (!item) {
      throw new Error("Sale item not found");
    }

    const saleId = item.saleId;

    // Return stock to inventory
    await db
      .update(colors)
      .set({
        stockQuantity: sql`${colors.stockQuantity} + ${item.quantity}`,
      })
      .where(eq(colors.id, item.colorId));

    // Delete the item
    await db.delete(saleItems).where(eq(saleItems.id, saleItemId));

    // Recalculate sale total
    const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    const newTotal = allItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    const amountPaid = parseFloat(sale.amountPaid);

    let paymentStatus: string;
    if (newTotal === 0) {
      paymentStatus = "paid";
    } else if (amountPaid >= newTotal) {
      paymentStatus = "paid";
    } else if (amountPaid > 0) {
      paymentStatus = "partial";
    } else {
      paymentStatus = "unpaid";
    }

    await db
      .update(sales)
      .set({
        totalAmount: newTotal.toString(),
        paymentStatus,
      })
      .where(eq(sales.id, saleId));
  }

  async returnSaleItem(saleItemId: string, quantity: number, reason: string): Promise<{ success: boolean }> {
    // Get the sale item
    const [item] = await db.select().from(saleItems).where(eq(saleItems.id, saleItemId));
    if (!item) {
      throw new Error("Sale item not found");
    }

    if (quantity > item.quantity) {
      throw new Error("Return quantity exceeds purchased quantity");
    }

    const saleId = item.saleId;

    // Update sale item quantity and subtotal
    const newQuantity = item.quantity - quantity;
    const newSubtotal = parseFloat(item.rate) * newQuantity;

    if (newQuantity === 0) {
      // Remove item if quantity becomes zero
      await this.deleteSaleItem(saleItemId);
    } else {
      // Update item
      await db
        .update(saleItems)
        .set({
          quantity: newQuantity,
          subtotal: newSubtotal.toString(),
        })
        .where(eq(saleItems.id, saleItemId));

      // Return stock to inventory
      await db
        .update(colors)
        .set({
          stockQuantity: sql`${colors.stockQuantity} + ${quantity}`,
        })
        .where(eq(colors.id, item.colorId));

      // Recalculate sale total
      const allItems = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
      const newTotal = allItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
      const amountPaid = parseFloat(sale.amountPaid);

      let paymentStatus: string;
      if (amountPaid >= newTotal) {
        paymentStatus = "paid";
      } else if (amountPaid > 0) {
        paymentStatus = "partial";
      } else {
        paymentStatus = "unpaid";
      }

      await db
        .update(sales)
        .set({
          totalAmount: newTotal.toString(),
          paymentStatus,
        })
        .where(eq(sales.id, saleId));
    }

    return { success: true };
  }

  async deleteSale(saleId: string): Promise<void> {
    // Get all sale items for this sale
    const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));

    // Return stock for all items
    for (const item of items) {
      await db
        .update(colors)
        .set({
          stockQuantity: sql`${colors.stockQuantity} + ${item.quantity}`,
        })
        .where(eq(colors.id, item.colorId));
    }

    // Delete sale items
    await db.delete(saleItems).where(eq(saleItems.saleId, saleId));

    // Delete sale
    await db.delete(sales).where(eq(sales.id, saleId));
  }

  // Customer Management
  async getCustomerSuggestions(limit: number = 10): Promise<any[]> {
    try {
      const suggestions = await db
        .select({
          customerName: sales.customerName,
          customerPhone: sales.customerPhone,
          lastSaleDate: sql<string>`MAX(${sales.createdAt})`,
          totalSpent: sql<number>`SUM(CAST(${sales.totalAmount} AS REAL))`,
        })
        .from(sales)
        .groupBy(sales.customerName, sales.customerPhone)
        .orderBy(sql`MAX(${sales.createdAt}) DESC`)
        .limit(limit);

      // Format dates to DD-MM-YYYY and ensure safe array mapping
      return (suggestions || []).map(suggestion => ({
        ...suggestion,
        lastSaleDate: this.formatDateToDDMMYYYY(new Date(parseInt(suggestion.lastSaleDate || Date.now().toString()))),
        totalSpent: Math.round(suggestion.totalSpent || 0)
      }));
    } catch (error) {
      console.error("Error fetching customer suggestions:", error);
      return [];
    }
  }

  async searchCustomers(query: string): Promise<any[]> {
    try {
      const results = await db
        .select({
          customerName: sales.customerName,
          customerPhone: sales.customerPhone,
          lastSaleDate: sql<string>`MAX(${sales.createdAt})`,
          totalSpent: sql<number>`SUM(CAST(${sales.totalAmount} AS REAL))`,
          outstandingBalance: sql<number>`SUM(CAST(${sales.totalAmount} AS REAL) - CAST(${sales.amountPaid} AS REAL))`,
        })
        .from(sales)
        .where(or(
          like(sales.customerName, `%${query}%`),
          like(sales.customerPhone, `%${query}%`)
        ))
        .groupBy(sales.customerName, sales.customerPhone)
        .orderBy(sql`MAX(${sales.createdAt}) DESC`);

      // Format dates to DD-MM-YYYY and ensure safe array mapping
      return (results || []).map(result => ({
        ...result,
        lastSaleDate: this.formatDateToDDMMYYYY(new Date(parseInt(result.lastSaleDate || Date.now().toString()))),
        totalSpent: Math.round(result.totalSpent || 0),
        outstandingBalance: Math.round(result.outstandingBalance || 0)
      }));
    } catch (error) {
      console.error("Error searching customers:", error);
      return [];
    }
  }

  async getCustomerBills(phone: string): Promise<Sale[]> {
    try {
      const bills = await db
        .select()
        .from(sales)
        .where(eq(sales.customerPhone, phone))
        .orderBy(desc(sales.createdAt));
      return bills || [];
    } catch (error) {
      console.error("Error fetching customer bills:", error);
      return [];
    }
  }

  // Reports
  async getSalesReport(params: { startDate?: string; endDate?: string; groupBy?: string }): Promise<any> {
    // Implementation for sales report
    return { message: "Sales report functionality to be implemented" };
  }

  async getInventoryReport(lowStockThreshold: number = 10): Promise<any> {
    try {
      const lowStockItems = await db
        .select()
        .from(colors)
        .innerJoin(variants, eq(colors.variantId, variants.id))
        .innerJoin(products, eq(variants.productId, products.id))
        .where(sql`${colors.stockQuantity} <= ${lowStockThreshold}`)
        .orderBy(colors.stockQuantity);

      return {
        lowStockItems: lowStockItems || [],
        threshold: lowStockThreshold
      };
    } catch (error) {
      console.error("Error generating inventory report:", error);
      return { lowStockItems: [], threshold: lowStockThreshold };
    }
  }

  async getCustomerDebtReport(): Promise<any> {
    try {
      const customerDebts = await db
        .select({
          customerName: sales.customerName,
          customerPhone: sales.customerPhone,
          totalOutstanding: sql<number>`SUM(CAST(${sales.totalAmount} AS REAL) - CAST(${sales.amountPaid} AS REAL))`,
          billCount: sql<number>`COUNT(*)`,
          oldestBill: sql<string>`MIN(${sales.createdAt})`,
        })
        .from(sales)
        .where(or(
          eq(sales.paymentStatus, 'unpaid'),
          eq(sales.paymentStatus, 'partial')
        ))
        .groupBy(sales.customerName, sales.customerPhone)
        .orderBy(sql`SUM(CAST(${sales.totalAmount} AS REAL) - CAST(${sales.amountPaid} AS REAL)) DESC`);

      // Format dates to DD-MM-YYYY and ensure safe array mapping
      return (customerDebts || []).map(debt => ({
        ...debt,
        oldestBill: this.formatDateToDDMMYYYY(new Date(parseInt(debt.oldestBill || Date.now().toString()))),
        totalOutstanding: Math.round(debt.totalOutstanding || 0)
      }));
    } catch (error) {
      console.error("Error generating customer debt report:", error);
      return [];
    }
  }

  // Search
  async searchProducts(params: { query?: string; company?: string; category?: string }): Promise<any[]> {
    try {
      let whereConditions = [];

      if (params.query) {
        whereConditions.push(or(
          like(products.productName, `%${params.query}%`),
          like(products.company, `%${params.query}%`)
        ));
      }

      if (params.company) {
        whereConditions.push(eq(products.company, params.company));
      }

      const results = await db
        .select()
        .from(products)
        .where(and(...whereConditions))
        .orderBy(desc(products.createdAt));

      return results || [];
    } catch (error) {
      console.error("Error searching products:", error);
      return [];
    }
  }

  async searchColors(params: { query?: string; company?: string; product?: string; variant?: string }): Promise<any[]> {
    try {
      let whereConditions = [];

      if (params.query) {
        whereConditions.push(or(
          like(colors.colorName, `%${params.query}%`),
          like(colors.colorCode, `%${params.query}%`)
        ));
      }

      const results = await db.query.colors.findMany({
        where: and(...whereConditions),
        with: {
          variant: {
            with: {
              product: true,
            },
          },
        },
        orderBy: desc(colors.createdAt),
      });

      // Additional filtering
      let filteredResults = results || [];

      if (params.company) {
        filteredResults = filteredResults.filter(color => 
          color?.variant?.product?.company?.includes(params.company!)
        );
      }

      if (params.product) {
        filteredResults = filteredResults.filter(color => 
          color?.variant?.product?.productName?.includes(params.product!)
        );
      }

      if (params.variant) {
        filteredResults = filteredResults.filter(color => 
          color?.variant?.packingSize?.includes(params.variant!)
        );
      }

      return filteredResults;
    } catch (error) {
      console.error("Error searching colors:", error);
      return [];
    }
  }

  // Bulk Operations
  async bulkStockIn(items: any[]): Promise<any[]> {
    const results = [];
    for (const item of items) {
      try {
        const result = await this.stockIn(item.colorId, item.quantity);
        results.push({ success: true, colorId: item.colorId, result });
      } catch (error) {
        results.push({ success: false, colorId: item.colorId, error: (error as Error).message });
      }
    }
    return results;
  }

  async bulkUpdateRates(updates: any[]): Promise<any[]> {
    const results = [];
    for (const update of updates) {
      try {
        const result = await this.updateVariantRate(update.variantId, update.rate);
        results.push({ success: true, variantId: update.variantId, result });
      } catch (error) {
        results.push({ success: false, variantId: update.variantId, error: (error as Error).message });
      }
    }
    return results;
  }

  // Export/Import
  async exportData(type?: string): Promise<any> {
    // Implementation for data export
    return { message: "Export functionality to be implemented" };
  }

  async importData(data: any, type: string): Promise<{ success: boolean }> {
    // Implementation for data import
    return { success: true, message: "Import functionality to be implemented" };
  }

  // Helper function to format dates to DD-MM-YYYY
  private formatDateToDDMMYYYY(date: Date): string {
    try {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      console.error("Error formatting date:", error);
      return "01-01-2024"; // Default fallback date
    }
  }

  // Dashboard Stats
  async getDashboardStats() {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Convert dates to Unix timestamps for SQLite
      const todayStartTimestamp = Math.floor(todayStart.getTime());
      const monthStartTimestamp = Math.floor(monthStart.getTime());

      // Today's sales
      const todaySalesData = await db
        .select({
          revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
          transactions: sql<number>`COUNT(*)`,
        })
        .from(sales)
        .where(sql`${sales.createdAt} >= ${todayStartTimestamp}`);

      // Monthly sales
      const monthlySalesData = await db
        .select({
          revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
          transactions: sql<number>`COUNT(*)`,
        })
        .from(sales)
        .where(sql`${sales.createdAt} >= ${monthStartTimestamp}`);

      // Inventory stats
      const totalProducts = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
      const totalVariants = await db.select({ count: sql<number>`COUNT(*)` }).from(variants);
      const totalColors = await db.select({ count: sql<number>`COUNT(*)` }).from(colors);
      const lowStockColors = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(colors)
        .where(sql`${colors.stockQuantity} < 10 AND ${colors.stockQuantity} > 0`);
      
      // Calculate total stock value (stockQuantity * rate for all colors)
      const totalStockValue = await db
        .select({
          value: sql<number>`COALESCE(SUM(${colors.stockQuantity} * CAST(${variants.rate} AS REAL)), 0)`,
        })
        .from(colors)
        .innerJoin(variants, eq(colors.variantId, variants.id));

      // Unpaid bills
      const unpaidData = await db
        .select({
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL) - CAST(${sales.amountPaid} AS REAL)), 0)`,
        })
        .from(sales)
        .where(or(
          eq(sales.paymentStatus, 'unpaid'),
          eq(sales.paymentStatus, 'partial')
        ));

      // Recent sales
      const recentSales = await db
        .select()
        .from(sales)
        .orderBy(desc(sales.createdAt))
        .limit(10);

      // Monthly chart data (last 30 days)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoTimestamp = Math.floor(thirtyDaysAgo.getTime());

      const dailySales = await db
        .select({
          date: sql<string>`DATE(${sales.createdAt} / 1000, 'unixepoch')`,
          revenue: sql<number>`COALESCE(SUM(CAST(${sales.totalAmount} AS REAL)), 0)`,
        })
        .from(sales)
        .where(sql`${sales.createdAt} >= ${thirtyDaysAgoTimestamp}`)
        .groupBy(sql`DATE(${sales.createdAt} / 1000, 'unixepoch')`)
        .orderBy(sql`DATE(${sales.createdAt} / 1000, 'unixepoch')`);

      // Format dates to DD-MM-YYYY for monthly chart
      const formattedMonthlyChart = (dailySales || []).map((day) => {
        try {
          const date = new Date(day.date);
          return {
            date: this.formatDateToDDMMYYYY(date),
            revenue: Number(day.revenue || 0),
          };
        } catch (error) {
          return {
            date: this.formatDateToDDMMYYYY(new Date()),
            revenue: Number(day.revenue || 0),
          };
        }
      });

      return {
        todaySales: {
          revenue: Number(todaySalesData[0]?.revenue || 0),
          transactions: Number(todaySalesData[0]?.transactions || 0),
        },
        monthlySales: {
          revenue: Number(monthlySalesData[0]?.revenue || 0),
          transactions: Number(monthlySalesData[0]?.transactions || 0),
        },
        inventory: {
          totalProducts: Number(totalProducts[0]?.count || 0),
          totalVariants: Number(totalVariants[0]?.count || 0),
          totalColors: Number(totalColors[0]?.count || 0),
          lowStock: Number(lowStockColors[0]?.count || 0),
          totalStockValue: Number(totalStockValue[0]?.value || 0),
        },
        unpaidBills: {
          count: Number(unpaidData[0]?.count || 0),
          totalAmount: Number(unpaidData[0]?.totalAmount || 0),
        },
        recentSales: recentSales || [],
        monthlyChart: formattedMonthlyChart,
      };
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      // Return default empty stats to prevent frontend crashes
      return {
        todaySales: { revenue: 0, transactions: 0 },
        monthlySales: { revenue: 0, transactions: 0 },
        inventory: { totalProducts: 0, totalVariants: 0, totalColors: 0, lowStock: 0, totalStockValue: 0 },
        unpaidBills: { count: 0, totalAmount: 0 },
        recentSales: [],
        monthlyChart: [],
      };
    }
  }
}

export const storage = new DatabaseStorage();
