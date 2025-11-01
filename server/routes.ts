import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertProductSchema, 
  insertVariantSchema, 
  insertColorSchema, 
  insertSaleSchema, 
  insertSaleItemSchema 
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Products
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validated = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validated);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid product data", details: error.errors });
      } else {
        console.error("Error creating product:", error);
        res.status(500).json({ error: "Failed to create product" });
      }
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const validated = insertProductSchema.parse(req.body);
      const product = await storage.updateProduct(req.params.id, validated);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid product data", details: error.errors });
      } else {
        console.error("Error updating product:", error);
        res.status(500).json({ error: "Failed to update product" });
      }
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Variants
  app.get("/api/variants", async (_req, res) => {
    try {
      const variants = await storage.getVariants();
      res.json(variants);
    } catch (error) {
      console.error("Error fetching variants:", error);
      res.status(500).json({ error: "Failed to fetch variants" });
    }
  });

  app.get("/api/variants/:id", async (req, res) => {
    try {
      const variant = await storage.getVariant(req.params.id);
      if (!variant) {
        res.status(404).json({ error: "Variant not found" });
        return;
      }
      res.json(variant);
    } catch (error) {
      console.error("Error fetching variant:", error);
      res.status(500).json({ error: "Failed to fetch variant" });
    }
  });

  app.post("/api/variants", async (req, res) => {
    try {
      const validated = insertVariantSchema.parse(req.body);
      const variant = await storage.createVariant(validated);
      res.json(variant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid variant data", details: error.errors });
      } else {
        console.error("Error creating variant:", error);
        res.status(500).json({ error: "Failed to create variant" });
      }
    }
  });

  app.put("/api/variants/:id", async (req, res) => {
    try {
      const validated = insertVariantSchema.parse(req.body);
      const variant = await storage.updateVariant(req.params.id, validated);
      res.json(variant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid variant data", details: error.errors });
      } else {
        console.error("Error updating variant:", error);
        res.status(500).json({ error: "Failed to update variant" });
      }
    }
  });

  app.patch("/api/variants/:id/rate", async (req, res) => {
    try {
      const { rate } = req.body;
      if (typeof rate !== "number" || rate <= 0) {
        res.status(400).json({ error: "Invalid rate" });
        return;
      }
      const variant = await storage.updateVariantRate(req.params.id, rate);
      res.json(variant);
    } catch (error) {
      console.error("Error updating variant rate:", error);
      res.status(500).json({ error: "Failed to update variant rate" });
    }
  });

  app.delete("/api/variants/:id", async (req, res) => {
    try {
      await storage.deleteVariant(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting variant:", error);
      res.status(500).json({ error: "Failed to delete variant" });
    }
  });

  // Colors
  app.get("/api/colors", async (_req, res) => {
    try {
      const colors = await storage.getColors();
      res.json(colors);
    } catch (error) {
      console.error("Error fetching colors:", error);
      res.status(500).json({ error: "Failed to fetch colors" });
    }
  });

  app.get("/api/colors/:id", async (req, res) => {
    try {
      const color = await storage.getColor(req.params.id);
      if (!color) {
        res.status(404).json({ error: "Color not found" });
        return;
      }
      res.json(color);
    } catch (error) {
      console.error("Error fetching color:", error);
      res.status(500).json({ error: "Failed to fetch color" });
    }
  });

  app.post("/api/colors", async (req, res) => {
    try {
      const validated = insertColorSchema.parse(req.body);
      const color = await storage.createColor(validated);
      res.json(color);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid color data", details: error.errors });
      } else {
        console.error("Error creating color:", error);
        res.status(500).json({ error: "Failed to create color" });
      }
    }
  });

  app.put("/api/colors/:id", async (req, res) => {
    try {
      const validated = insertColorSchema.parse(req.body);
      const color = await storage.updateColor(req.params.id, validated);
      res.json(color);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid color data", details: error.errors });
      } else {
        console.error("Error updating color:", error);
        res.status(500).json({ error: "Failed to update color" });
      }
    }
  });

  app.patch("/api/colors/:id/stock", async (req, res) => {
    try {
      const { stockQuantity } = req.body;
      if (typeof stockQuantity !== "number" || stockQuantity < 0) {
        res.status(400).json({ error: "Invalid stock quantity" });
        return;
      }
      const color = await storage.updateColorStock(req.params.id, stockQuantity);
      res.json(color);
    } catch (error) {
      console.error("Error updating color stock:", error);
      res.status(500).json({ error: "Failed to update color stock" });
    }
  });

  app.post("/api/colors/:id/stock-in", async (req, res) => {
    try {
      const { quantity } = req.body;
      if (typeof quantity !== "number" || quantity <= 0) {
        res.status(400).json({ error: "Invalid quantity" });
        return;
      }
      const color = await storage.stockIn(req.params.id, quantity);
      res.json(color);
    } catch (error) {
      console.error("Error adding stock:", error);
      res.status(500).json({ error: "Failed to add stock" });
    }
  });

  app.delete("/api/colors/:id", async (req, res) => {
    try {
      await storage.deleteColor(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting color:", error);
      res.status(500).json({ error: "Failed to delete color" });
    }
  });

  // Sales
  app.get("/api/sales", async (_req, res) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.get("/api/sales/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const sales = await storage.getRecentSales(limit);
      res.json(sales);
    } catch (error) {
      console.error("Error fetching recent sales:", error);
      res.status(500).json({ error: "Failed to fetch recent sales" });
    }
  });

  app.get("/api/sales/unpaid", async (_req, res) => {
    try {
      const sales = await storage.getUnpaidSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching unpaid sales:", error);
      res.status(500).json({ error: "Failed to fetch unpaid sales" });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        res.status(404).json({ error: "Sale not found" });
        return;
      }
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ error: "Failed to fetch sale" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const { items, ...saleData } = req.body;

      console.log("Creating sale - request body:", JSON.stringify(req.body, null, 2));

      // Validate sale data
      const validatedSale = insertSaleSchema.parse(saleData);

      // Validate sale items
      const validatedItems = z.array(insertSaleItemSchema).parse(items);

      // Check if this is an unpaid sale and customer has existing unpaid bill
      if (validatedSale.paymentStatus === "unpaid" || validatedSale.paymentStatus === "partial") {
        const existingUnpaidSale = await storage.findUnpaidSaleByPhone(validatedSale.customerPhone);
        
        if (existingUnpaidSale) {
          // Add items to existing unpaid bill instead of creating new sale
          console.log("Found existing unpaid bill, adding items to it:", existingUnpaidSale.id);
          
          // Add all items to the existing sale
          for (const item of validatedItems) {
            await storage.addSaleItem(existingUnpaidSale.id, item);
          }
          
          // Fetch the updated sale to return
          const updatedSale = await storage.getSale(existingUnpaidSale.id);
          console.log("Items added to existing unpaid bill successfully");
          
          res.json(updatedSale);
          return;
        }
      }

      // Create new sale with items (if not unpaid or no existing unpaid bill)
      const sale = await storage.createSale(validatedSale, validatedItems);
      
      console.log("Sale created successfully:", JSON.stringify(sale, null, 2));
      
      res.json(sale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error creating sale:", error.errors);
        res.status(400).json({ error: "Invalid sale data", details: error.errors });
      } else {
        console.error("Error creating sale:", error);
        res.status(500).json({ error: "Failed to create sale" });
      }
    }
  });

  app.post("/api/sales/:id/payment", async (req, res) => {
    try {
      const { amount } = req.body;
      if (typeof amount !== "number" || amount <= 0) {
        res.status(400).json({ error: "Invalid payment amount" });
        return;
      }
      const sale = await storage.updateSalePayment(req.params.id, amount);
      res.json(sale);
    } catch (error) {
      console.error("Error recording payment:", error);
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  app.post("/api/sales/:id/items", async (req, res) => {
    try {
      const validated = insertSaleItemSchema.parse(req.body);
      const saleItem = await storage.addSaleItem(req.params.id, validated);
      res.json(saleItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid sale item data", details: error.errors });
      } else {
        console.error("Error adding sale item:", error);
        res.status(500).json({ error: "Failed to add sale item" });
      }
    }
  });

  app.delete("/api/sale-items/:id", async (req, res) => {
    try {
      await storage.deleteSaleItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sale item:", error);
      res.status(500).json({ error: "Failed to delete sale item" });
    }
  });

  app.post("/api/sale-items/:id/return", async (req, res) => {
    try {
      const { quantity, reason } = req.body;
      if (typeof quantity !== "number" || quantity <= 0) {
        res.status(400).json({ error: "Invalid return quantity" });
        return;
      }
      const result = await storage.returnSaleItem(req.params.id, quantity, reason || "Customer return");
      res.json(result);
    } catch (error) {
      console.error("Error processing return:", error);
      res.status(500).json({ error: "Failed to process return" });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      await storage.deleteSale(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sale:", error);
      res.status(500).json({ error: "Failed to delete sale" });
    }
  });

  // Customer Management
  app.get("/api/customers/suggestions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const suggestions = await storage.getCustomerSuggestions(limit);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching customer suggestions:", error);
      res.status(500).json({ error: "Failed to fetch customer suggestions" });
    }
  });

  app.get("/api/customers/search", async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== "string") {
        res.status(400).json({ error: "Search query is required" });
        return;
      }
      const customers = await storage.searchCustomers(query);
      res.json(customers);
    } catch (error) {
      console.error("Error searching customers:", error);
      res.status(500).json({ error: "Failed to search customers" });
    }
  });

  app.get("/api/customers/:phone/bills", async (req, res) => {
    try {
      const bills = await storage.getCustomerBills(req.params.phone);
      res.json(bills);
    } catch (error) {
      console.error("Error fetching customer bills:", error);
      res.status(500).json({ error: "Failed to fetch customer bills" });
    }
  });

  // Reports and Analytics
  app.get("/api/reports/sales", async (req, res) => {
    try {
      const { startDate, endDate, groupBy = "day" } = req.query;
      const report = await storage.getSalesReport({
        startDate: startDate as string,
        endDate: endDate as string,
        groupBy: groupBy as "day" | "week" | "month"
      });
      res.json(report);
    } catch (error) {
      console.error("Error generating sales report:", error);
      res.status(500).json({ error: "Failed to generate sales report" });
    }
  });

  app.get("/api/reports/inventory", async (req, res) => {
    try {
      const { lowStockThreshold = 10 } = req.query;
      const report = await storage.getInventoryReport(parseInt(lowStockThreshold as string));
      res.json(report);
    } catch (error) {
      console.error("Error generating inventory report:", error);
      res.status(500).json({ error: "Failed to generate inventory report" });
    }
  });

  app.get("/api/reports/customer-debt", async (_req, res) => {
    try {
      const report = await storage.getCustomerDebtReport();
      res.json(report);
    } catch (error) {
      console.error("Error generating customer debt report:", error);
      res.status(500).json({ error: "Failed to generate customer debt report" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard-stats", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Export/Import
  app.get("/api/export/data", async (req, res) => {
    try {
      const { type = "all" } = req.query;
      const data = await storage.exportData(type as string);
      res.json(data);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  app.post("/api/import/data", async (req, res) => {
    try {
      const { data, type } = req.body;
      const result = await storage.importData(data, type);
      res.json(result);
    } catch (error) {
      console.error("Error importing data:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  // Search and Filter endpoints
  app.get("/api/search/products", async (req, res) => {
    try {
      const { q, company, category } = req.query;
      const products = await storage.searchProducts({
        query: q as string,
        company: company as string,
        category: category as string
      });
      res.json(products);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ error: "Failed to search products" });
    }
  });

  app.get("/api/search/colors", async (req, res) => {
    try {
      const { q, company, product, variant } = req.query;
      const colors = await storage.searchColors({
        query: q as string,
        company: company as string,
        product: product as string,
        variant: variant as string
      });
      res.json(colors);
    } catch (error) {
      console.error("Error searching colors:", error);
      res.status(500).json({ error: "Failed to search colors" });
    }
  });

  // Bulk Operations
  app.post("/api/bulk/stock-in", async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        res.status(400).json({ error: "Items must be an array" });
        return;
      }
      const results = await storage.bulkStockIn(items);
      res.json(results);
    } catch (error) {
      console.error("Error processing bulk stock in:", error);
      res.status(500).json({ error: "Failed to process bulk stock in" });
    }
  });

  app.post("/api/bulk/update-rates", async (req, res) => {
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates)) {
        res.status(400).json({ error: "Updates must be an array" });
        return;
      }
      const results = await storage.bulkUpdateRates(updates);
      res.json(results);
    } catch (error) {
      console.error("Error processing bulk rate updates:", error);
      res.status(500).json({ error: "Failed to process bulk rate updates" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
