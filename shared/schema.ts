import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Helper function to generate UUIDs (used in SQLite as default)
// This will be replaced by actual UUID generation in the storage layer
const sqliteUuidDefault = sql`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;

// Products table - stores company and product names
export const products = sqliteTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  company: text("company").notNull(),
  productName: text("product_name").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Variants table - stores packing sizes and rates for each product
export const variants = sqliteTable("variants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  packingSize: text("packing_size").notNull(), // e.g., 1L, 4L, 16L
  rate: text("rate").notNull(), // stored as text to preserve decimal precision
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Colors table - stores color codes and inventory for each variant
export const colors = sqliteTable("colors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  variantId: text("variant_id").notNull().references(() => variants.id, { onDelete: "cascade" }),
  colorName: text("color_name").notNull(), // e.g., "Sky Blue", "Sunset Red"
  colorCode: text("color_code").notNull(), // e.g., RAL1015, RAL5002
  stockQuantity: integer("stock_quantity").notNull().default(0),
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Sales table - stores transaction records
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  totalAmount: text("total_amount").notNull(), // stored as text to preserve decimal precision
  amountPaid: text("amount_paid").notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid, partial, paid
  createdAt: integer("created_at", { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
});

// Sale Items table - stores individual items in each sale
export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  colorId: text("color_id").notNull().references(() => colors.id),
  quantity: integer("quantity").notNull(),
  rate: text("rate").notNull(), // stored as text to preserve decimal precision
  subtotal: text("subtotal").notNull(), // stored as text to preserve decimal precision
});

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  variants: many(variants),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  colors: many(colors),
}));

export const colorsRelations = relations(colors, ({ one, many }) => ({
  variant: one(variants, {
    fields: [colors.variantId],
    references: [variants.id],
  }),
  saleItems: many(saleItems),
}));

export const salesRelations = relations(sales, ({ many }) => ({
  saleItems: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  color: one(colors, {
    fields: [saleItems.colorId],
    references: [colors.id],
  }),
}));

// Insert schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertVariantSchema = createInsertSchema(variants).omit({
  id: true,
  createdAt: true,
}).extend({
  rate: z.string().or(z.number()),
});

export const insertColorSchema = createInsertSchema(colors).omit({
  id: true,
  createdAt: true,
}).extend({
  stockQuantity: z.number().int().min(0),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
}).extend({
  totalAmount: z.string().or(z.number()),
  amountPaid: z.string().or(z.number()),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]),
});

export const insertSaleItemSchema = createInsertSchema(saleItems).omit({
  id: true,
  saleId: true,
}).extend({
  quantity: z.number().int().min(1),
  rate: z.string().or(z.number()),
  subtotal: z.string().or(z.number()),
});

// Select schemas
export const selectProductSchema = createSelectSchema(products);
export const selectVariantSchema = createSelectSchema(variants);
export const selectColorSchema = createSelectSchema(colors);
export const selectSaleSchema = createSelectSchema(sales);
export const selectSaleItemSchema = createSelectSchema(saleItems);

// Types
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type Variant = typeof variants.$inferSelect;

export type InsertColor = z.infer<typeof insertColorSchema>;
export type Color = typeof colors.$inferSelect;

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItems.$inferSelect;

// Extended types for queries with relations
export type VariantWithProduct = Variant & {
  product: Product;
};

export type ColorWithVariantAndProduct = Color & {
  variant: VariantWithProduct;
};

export type SaleWithItems = Sale & {
  saleItems: (SaleItem & {
    color: ColorWithVariantAndProduct;
  })[];
};

export type SaleItemWithDetails = SaleItem & {
  color: ColorWithVariantAndProduct;
};
