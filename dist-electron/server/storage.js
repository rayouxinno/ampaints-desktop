"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
const schema_1 = require("@shared/schema");
const db_1 = require("./db");
const drizzle_orm_1 = require("drizzle-orm");
class DatabaseStorage {
    // Products
    async getProducts() {
        return await db_1.db.select().from(schema_1.products).orderBy((0, drizzle_orm_1.desc)(schema_1.products.createdAt));
    }
    async getProduct(id) {
        const [product] = await db_1.db.select().from(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, id));
        return product || undefined;
    }
    async createProduct(insertProduct) {
        const product = {
            id: crypto.randomUUID(),
            ...insertProduct,
            createdAt: new Date(),
        };
        await db_1.db.insert(schema_1.products).values(product);
        return product;
    }
    async deleteProduct(id) {
        await db_1.db.delete(schema_1.products).where((0, drizzle_orm_1.eq)(schema_1.products.id, id));
    }
    // Variants
    async getVariants() {
        const result = await db_1.db.query.variants.findMany({
            with: {
                product: true,
            },
            orderBy: (0, drizzle_orm_1.desc)(schema_1.variants.createdAt),
        });
        return result;
    }
    async getVariant(id) {
        const [variant] = await db_1.db.select().from(schema_1.variants).where((0, drizzle_orm_1.eq)(schema_1.variants.id, id));
        return variant || undefined;
    }
    async createVariant(insertVariant) {
        const variant = {
            id: crypto.randomUUID(),
            ...insertVariant,
            rate: typeof insertVariant.rate === 'number' ? insertVariant.rate.toString() : insertVariant.rate,
            createdAt: new Date(),
        };
        await db_1.db.insert(schema_1.variants).values(variant);
        return variant;
    }
    async updateVariantRate(id, rate) {
        await db_1.db
            .update(schema_1.variants)
            .set({ rate: rate.toString() })
            .where((0, drizzle_orm_1.eq)(schema_1.variants.id, id));
        const [variant] = await db_1.db.select().from(schema_1.variants).where((0, drizzle_orm_1.eq)(schema_1.variants.id, id));
        return variant;
    }
    async deleteVariant(id) {
        await db_1.db.delete(schema_1.variants).where((0, drizzle_orm_1.eq)(schema_1.variants.id, id));
    }
    // Colors
    async getColors() {
        const result = await db_1.db.query.colors.findMany({
            with: {
                variant: {
                    with: {
                        product: true,
                    },
                },
            },
            orderBy: (0, drizzle_orm_1.desc)(schema_1.colors.createdAt),
        });
        return result;
    }
    async getColor(id) {
        const [color] = await db_1.db.select().from(schema_1.colors).where((0, drizzle_orm_1.eq)(schema_1.colors.id, id));
        return color || undefined;
    }
    async createColor(insertColor) {
        const color = {
            id: crypto.randomUUID(),
            ...insertColor,
            createdAt: new Date(),
        };
        await db_1.db.insert(schema_1.colors).values(color);
        return color;
    }
    async updateColorStock(id, stockQuantity) {
        await db_1.db
            .update(schema_1.colors)
            .set({ stockQuantity })
            .where((0, drizzle_orm_1.eq)(schema_1.colors.id, id));
        const [color] = await db_1.db.select().from(schema_1.colors).where((0, drizzle_orm_1.eq)(schema_1.colors.id, id));
        return color;
    }
    async stockIn(id, quantity) {
        await db_1.db
            .update(schema_1.colors)
            .set({
            stockQuantity: (0, drizzle_orm_1.sql) `${schema_1.colors.stockQuantity} + ${quantity}`,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.colors.id, id));
        const [color] = await db_1.db.select().from(schema_1.colors).where((0, drizzle_orm_1.eq)(schema_1.colors.id, id));
        return color;
    }
    async deleteColor(id) {
        await db_1.db.delete(schema_1.colors).where((0, drizzle_orm_1.eq)(schema_1.colors.id, id));
    }
    // Sales
    async getSales() {
        return await db_1.db.select().from(schema_1.sales).orderBy((0, drizzle_orm_1.desc)(schema_1.sales.createdAt));
    }
    async getUnpaidSales() {
        return await db_1.db
            .select()
            .from(schema_1.sales)
            .where((0, drizzle_orm_1.sql) `${schema_1.sales.paymentStatus} != 'paid'`)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.sales.createdAt));
    }
    async findUnpaidSaleByPhone(customerPhone) {
        const [sale] = await db_1.db
            .select()
            .from(schema_1.sales)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.sales.customerPhone, customerPhone), (0, drizzle_orm_1.sql) `${schema_1.sales.paymentStatus} != 'paid'`))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.sales.createdAt))
            .limit(1);
        return sale;
    }
    async getSale(id) {
        const result = await db_1.db.query.sales.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.sales.id, id),
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
        return result;
    }
    async createSale(insertSale, items) {
        const sale = {
            id: crypto.randomUUID(),
            ...insertSale,
            totalAmount: typeof insertSale.totalAmount === 'number' ? insertSale.totalAmount.toString() : insertSale.totalAmount,
            amountPaid: typeof insertSale.amountPaid === 'number' ? insertSale.amountPaid.toString() : insertSale.amountPaid,
            createdAt: new Date(),
        };
        await db_1.db.insert(schema_1.sales).values(sale);
        // Insert sale items
        const saleItemsToInsert = items.map((item) => ({
            id: crypto.randomUUID(),
            ...item,
            saleId: sale.id,
            rate: typeof item.rate === 'number' ? item.rate.toString() : item.rate,
            subtotal: typeof item.subtotal === 'number' ? item.subtotal.toString() : item.subtotal,
        }));
        await db_1.db.insert(schema_1.saleItems).values(saleItemsToInsert);
        // Update stock quantities in colors table
        for (const item of items) {
            await db_1.db
                .update(schema_1.colors)
                .set({
                stockQuantity: (0, drizzle_orm_1.sql) `${schema_1.colors.stockQuantity} - ${item.quantity}`,
            })
                .where((0, drizzle_orm_1.eq)(schema_1.colors.id, item.colorId));
        }
        return sale;
    }
    async updateSalePayment(saleId, amount) {
        const [sale] = await db_1.db.select().from(schema_1.sales).where((0, drizzle_orm_1.eq)(schema_1.sales.id, saleId));
        if (!sale) {
            throw new Error("Sale not found");
        }
        const currentPaid = parseFloat(sale.amountPaid);
        const newPaid = currentPaid + amount;
        const total = parseFloat(sale.totalAmount);
        let paymentStatus;
        if (newPaid >= total) {
            paymentStatus = "paid";
        }
        else if (newPaid > 0) {
            paymentStatus = "partial";
        }
        else {
            paymentStatus = "unpaid";
        }
        await db_1.db
            .update(schema_1.sales)
            .set({
            amountPaid: newPaid.toString(),
            paymentStatus,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.sales.id, saleId));
        const [updatedSale] = await db_1.db.select().from(schema_1.sales).where((0, drizzle_orm_1.eq)(schema_1.sales.id, saleId));
        return updatedSale;
    }
    async addSaleItem(saleId, item) {
        // Add the item to the sale
        const saleItem = {
            id: crypto.randomUUID(),
            ...item,
            saleId,
            rate: typeof item.rate === 'number' ? item.rate.toString() : item.rate,
            subtotal: typeof item.subtotal === 'number' ? item.subtotal.toString() : item.subtotal,
        };
        await db_1.db.insert(schema_1.saleItems).values(saleItem);
        // Update stock for this color
        await db_1.db
            .update(schema_1.colors)
            .set({
            stockQuantity: (0, drizzle_orm_1.sql) `${schema_1.colors.stockQuantity} - ${item.quantity}`,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.colors.id, item.colorId));
        // Recalculate sale total
        const allItems = await db_1.db.select().from(schema_1.saleItems).where((0, drizzle_orm_1.eq)(schema_1.saleItems.saleId, saleId));
        const newTotal = allItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
        const [sale] = await db_1.db.select().from(schema_1.sales).where((0, drizzle_orm_1.eq)(schema_1.sales.id, saleId));
        const amountPaid = parseFloat(sale.amountPaid);
        let paymentStatus;
        if (amountPaid >= newTotal) {
            paymentStatus = "paid";
        }
        else if (amountPaid > 0) {
            paymentStatus = "partial";
        }
        else {
            paymentStatus = "unpaid";
        }
        await db_1.db
            .update(schema_1.sales)
            .set({
            totalAmount: newTotal.toString(),
            paymentStatus,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.sales.id, saleId));
        return saleItem;
    }
    async deleteSaleItem(saleItemId) {
        // Get the item details before deleting
        const [item] = await db_1.db.select().from(schema_1.saleItems).where((0, drizzle_orm_1.eq)(schema_1.saleItems.id, saleItemId));
        if (!item) {
            throw new Error("Sale item not found");
        }
        const saleId = item.saleId;
        // Return stock to inventory
        await db_1.db
            .update(schema_1.colors)
            .set({
            stockQuantity: (0, drizzle_orm_1.sql) `${schema_1.colors.stockQuantity} + ${item.quantity}`,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.colors.id, item.colorId));
        // Delete the item
        await db_1.db.delete(schema_1.saleItems).where((0, drizzle_orm_1.eq)(schema_1.saleItems.id, saleItemId));
        // Recalculate sale total
        const allItems = await db_1.db.select().from(schema_1.saleItems).where((0, drizzle_orm_1.eq)(schema_1.saleItems.saleId, saleId));
        const newTotal = allItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
        const [sale] = await db_1.db.select().from(schema_1.sales).where((0, drizzle_orm_1.eq)(schema_1.sales.id, saleId));
        const amountPaid = parseFloat(sale.amountPaid);
        let paymentStatus;
        if (newTotal === 0) {
            paymentStatus = "paid";
        }
        else if (amountPaid >= newTotal) {
            paymentStatus = "paid";
        }
        else if (amountPaid > 0) {
            paymentStatus = "partial";
        }
        else {
            paymentStatus = "unpaid";
        }
        await db_1.db
            .update(schema_1.sales)
            .set({
            totalAmount: newTotal.toString(),
            paymentStatus,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.sales.id, saleId));
    }
    // Dashboard Stats
    async getDashboardStats() {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Convert dates to Unix timestamps for SQLite
        const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000) * 1000;
        const monthStartTimestamp = Math.floor(monthStart.getTime() / 1000) * 1000;
        // Today's sales
        const todaySalesData = await db_1.db
            .select({
            revenue: (0, drizzle_orm_1.sql) `COALESCE(SUM(CAST(${schema_1.sales.totalAmount} AS REAL)), 0)`,
            transactions: (0, drizzle_orm_1.sql) `COUNT(*)`,
        })
            .from(schema_1.sales)
            .where((0, drizzle_orm_1.sql) `${schema_1.sales.createdAt} >= ${todayStartTimestamp}`);
        // Monthly sales
        const monthlySalesData = await db_1.db
            .select({
            revenue: (0, drizzle_orm_1.sql) `COALESCE(SUM(CAST(${schema_1.sales.totalAmount} AS REAL)), 0)`,
            transactions: (0, drizzle_orm_1.sql) `COUNT(*)`,
        })
            .from(schema_1.sales)
            .where((0, drizzle_orm_1.sql) `${schema_1.sales.createdAt} >= ${monthStartTimestamp}`);
        // Inventory stats
        const totalProducts = await db_1.db.select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` }).from(schema_1.products);
        const totalVariants = await db_1.db.select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` }).from(schema_1.variants);
        const totalColors = await db_1.db.select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` }).from(schema_1.colors);
        const lowStockColors = await db_1.db
            .select({ count: (0, drizzle_orm_1.sql) `COUNT(*)` })
            .from(schema_1.colors)
            .where((0, drizzle_orm_1.sql) `${schema_1.colors.stockQuantity} < 10 AND ${schema_1.colors.stockQuantity} > 0`);
        // Calculate total stock value (stockQuantity * rate for all colors)
        const totalStockValue = await db_1.db
            .select({
            value: (0, drizzle_orm_1.sql) `COALESCE(SUM(${schema_1.colors.stockQuantity} * CAST(${schema_1.variants.rate} AS REAL)), 0)`,
        })
            .from(schema_1.colors)
            .innerJoin(schema_1.variants, (0, drizzle_orm_1.eq)(schema_1.colors.variantId, schema_1.variants.id));
        // Unpaid bills
        const unpaidData = await db_1.db
            .select({
            count: (0, drizzle_orm_1.sql) `COUNT(*)`,
            totalAmount: (0, drizzle_orm_1.sql) `COALESCE(SUM(CAST(${schema_1.sales.totalAmount} AS REAL) - CAST(${schema_1.sales.amountPaid} AS REAL)), 0)`,
        })
            .from(schema_1.sales)
            .where((0, drizzle_orm_1.sql) `${schema_1.sales.paymentStatus} != 'paid'`);
        // Recent sales
        const recentSales = await db_1.db
            .select()
            .from(schema_1.sales)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.sales.createdAt))
            .limit(10);
        // Monthly chart data (last 30 days)
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoTimestamp = Math.floor(thirtyDaysAgo.getTime() / 1000) * 1000;
        const dailySales = await db_1.db
            .select({
            date: (0, drizzle_orm_1.sql) `DATE(${schema_1.sales.createdAt} / 1000, 'unixepoch')`,
            revenue: (0, drizzle_orm_1.sql) `COALESCE(SUM(CAST(${schema_1.sales.totalAmount} AS REAL)), 0)`,
        })
            .from(schema_1.sales)
            .where((0, drizzle_orm_1.sql) `${schema_1.sales.createdAt} >= ${thirtyDaysAgoTimestamp}`)
            .groupBy((0, drizzle_orm_1.sql) `DATE(${schema_1.sales.createdAt} / 1000, 'unixepoch')`)
            .orderBy((0, drizzle_orm_1.sql) `DATE(${schema_1.sales.createdAt} / 1000, 'unixepoch')`);
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
            recentSales,
            monthlyChart: dailySales.map((day) => ({
                date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                revenue: Number(day.revenue),
            })),
        };
    }
}
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();
