import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const orderSessions = mysqlTable("orderSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceText: text("sourceText"),
  sourceImageKey: varchar("sourceImageKey", { length: 512 }),
  sourceImageUrl: varchar("sourceImageUrl", { length: 1024 }),
  customers: json("customers").notNull(),
  generalWarnings: json("generalWarnings").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const parserMemories = mysqlTable("parserMemories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  instruction: text("instruction").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type OrderSession = typeof orderSessions.$inferSelect;
export type ParserMemory = typeof parserMemories.$inferSelect;
