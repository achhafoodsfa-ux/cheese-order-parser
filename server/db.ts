import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { type InsertUser, orderSessions, type OrderSession, parserMemories, type ParserMemory, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) _db = drizzle(process.env.DATABASE_URL);
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet = { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn, ...(user.role ? { role: user.role } : user.openId === ENV.ownerOpenId ? { role: "admin" as const } : {}) };
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

export async function createOrderSession(values: Omit<typeof orderSessions.$inferInsert, "id" | "createdAt">): Promise<OrderSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(orderSessions).values(values);
  const id = Number(result[0].insertId);
  return getOrderSessionById(values.userId, id);
}

export async function getOrderSessionById(userId: number, id: number): Promise<OrderSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(orderSessions).where(eq(orderSessions.id, id)).limit(1);
  return rows[0]?.userId === userId ? rows[0] : undefined;
}

export async function listOrderSessions(userId: number): Promise<OrderSession[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderSessions).where(eq(orderSessions.userId, userId)).orderBy(desc(orderSessions.createdAt)).limit(60);
}

export async function listParserMemories(userId: number): Promise<ParserMemory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(parserMemories).where(eq(parserMemories.userId, userId)).orderBy(desc(parserMemories.updatedAt)).limit(80);
}

export async function createParserMemory(values: Omit<typeof parserMemories.$inferInsert, "id" | "createdAt" | "updatedAt">): Promise<ParserMemory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(parserMemories).values(values);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(parserMemories).where(eq(parserMemories.id, id)).limit(1);
  return rows[0];
}

export async function deleteParserMemory(userId: number, id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(parserMemories).where(eq(parserMemories.id, id)).limit(1);
  if (rows[0]?.userId !== userId) return false;
  await db.delete(parserMemories).where(eq(parserMemories.id, id));
  return true;
}
