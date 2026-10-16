import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  openId: varchar('openId', { length: 64 }).notNull().unique(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  loginMethod: varchar('loginMethod', { length: 64 }),
  role: mysqlEnum('role', ['user', 'admin']).default('user').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp('lastSignedIn').defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const billingAccounts = mysqlTable('billingAccounts', {
  userId: int('userId').primaryKey().references(() => users.id),
  appAccountToken: varchar('appAccountToken', { length: 36 }).notNull().unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});
export const billingCatalog = mysqlTable('billingCatalog', {
  key: varchar('key', { length: 100 }).primaryKey(),
  environment: mysqlEnum('environment', ['test', 'live']).notNull(),
  stripeProductId: varchar('stripeProductId', { length: 100 }).notNull(),
  stripePriceId: varchar('stripePriceId', { length: 100 }).notNull(),
});
export const billingPurchases = mysqlTable('billingPurchases', {
  key: varchar('key', { length: 255 }).primaryKey(),
  userId: int('userId').notNull().references(() => users.id),
  provider: mysqlEnum('provider', ['stripe', 'apple']).notNull(),
  environment: mysqlEnum('environment', ['test', 'live']).notNull(),
  productKey: varchar('productKey', { length: 100 }).notNull(),
  status: mysqlEnum('status', ['pending', 'active', 'refunded', 'revoked', 'expired', 'failed']).notNull(),
  providerTransactionId: varchar('providerTransactionId', { length: 200 }).notNull(),
  checkoutSessionId: varchar('checkoutSessionId', { length: 200 }),
  paymentIntentId: varchar('paymentIntentId', { length: 100 }),
  customerId: varchar('customerId', { length: 100 }),
  originalTransactionId: varchar('originalTransactionId', { length: 100 }),
  // Provider-derived values cached solely for the requested purchase-history display.
  amount: decimal('amount', { precision: 15, scale: 3 }),
  currency: varchar('currency', { length: 3 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
export type StoredPurchase = typeof billingPurchases.$inferSelect;
export type PurchaseInsert = typeof billingPurchases.$inferInsert;

export const billingEvents = mysqlTable('billingEvents', {
  key: varchar('key', { length: 255 }).primaryKey(),
  processedAt: timestamp('processedAt').defaultNow().notNull(),
});
export const billingLoginChallenges = mysqlTable('billingLoginChallenges', {
  nonceHash: varchar('nonceHash', { length: 64 }).primaryKey(),
  redirectUri: varchar('redirectUri', { length: 2048 }).notNull(),
  kind: mysqlEnum('kind', ['web', 'native']).notNull(),
  verifierHash: varchar('verifierHash', { length: 64 }),
  expiresAt: timestamp('expiresAt').notNull(),
  consumedAt: timestamp('consumedAt'),
});
