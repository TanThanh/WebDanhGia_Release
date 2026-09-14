import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import officialRules from "../../data/point-rules.json";

export type JsonUser = { id: string; email: string; name: string; role: "ADMIN" | "TEACHER" | "VIEWER"; active: boolean; createdAt: string; updatedAt: string };
export type JsonClass = { id: string; name: string; schoolYear: string; active: boolean; createdAt: string; updatedAt: string };
export type JsonStudent = { id: string; ordinal: string; fullName: string; normalizedName: string; dateOfBirth: string; gender: string; phone: string; note: string; classId: string; status: "ACTIVE" | "ARCHIVED"; importId: string; createdAt: string; updatedAt: string };
export type JsonPointRule = { id: string; type: "CREDIT" | "DEBIT"; points: number; category: string; title: string; note: string; sourcePage: number | null; schoolYear: string; active: boolean; sortOrder: number };
export type JsonBatch = { id: string; status: "ACTIVE" | "VOIDED" | "PARTIALLY_VOIDED"; note: string; activityDate: string; createdById: string; createdAt: string; updatedAt: string };
export type JsonTransaction = { id: string; batchId: string; studentId: string; ruleId: string; points: number; ruleTitle: string; ruleCategory: string; activityDate: string; note: string; status: "ACTIVE" | "VOIDED" | "REVERSED"; recordedById: string; voidedById: string; voidedAt: string; voidReason: string; createdAt: string; updatedAt: string };
export type JsonImport = { id: string; fileName: string; mode: "replace" | "append"; sourceRowCount: number; importedCount: number; skippedCount: number; mapping: Record<string, number>; createdById: string; createdAt: string };
export type JsonAudit = { id: string; actorId: string; action: string; entityType: string; entityId: string; metadata: Record<string, unknown>; createdAt: string };

export type JsonDatabase = {
  version: 1;
  users: JsonUser[];
  classes: JsonClass[];
  students: JsonStudent[];
  pointRules: JsonPointRule[];
  pointTransactions: JsonTransaction[];
  transactionBatches: JsonBatch[];
  studentImports: JsonImport[];
  auditLogs: JsonAudit[];
  settings: { app: { schoolYear: string; semester: string; startingScore: number; capScore: boolean; updatedAt: string } };
};

const databasePath = path.join(process.cwd(), "data", "db.json");
let writeQueue = Promise.resolve();

function initialDatabase(): JsonDatabase {
  const now = new Date().toISOString();
  return {
    version: 1,
    users: [{ id: randomUUID(), email: "admin@renluyen.local", name: "Quản trị viên", role: "ADMIN", active: true, createdAt: now, updatedAt: now }],
    classes: [], students: [], pointRules: officialRules as JsonPointRule[], pointTransactions: [], transactionBatches: [], studentImports: [], auditLogs: [],
    settings: { app: { schoolYear: "2026–2027", semester: "Học kỳ I", startingScore: 50, capScore: true, updatedAt: now } },
  };
}

async function readDatabase(): Promise<JsonDatabase> {
  try {
    const database = JSON.parse(await fs.readFile(databasePath, "utf8")) as JsonDatabase;
    if (database.version !== 1) throw new Error("Phiên bản JSON database không được hỗ trợ.");
    return database;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const database = initialDatabase();
    await persistDatabase(database);
    return database;
  }
}

async function persistDatabase(database: JsonDatabase) {
  await fs.mkdir(path.dirname(databasePath), { recursive: true });
  const temporaryPath = `${databasePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, databasePath);
}

export function createId() { return randomUUID(); }

export async function getDatabase(): Promise<JsonDatabase> {
  await writeQueue;
  return structuredClone(await readDatabase());
}

export async function updateDatabase<T>(mutate: (database: JsonDatabase) => T | Promise<T>): Promise<T> {
  let result!: T;
  const operation = writeQueue.then(async () => {
    const database = await readDatabase();
    result = await mutate(database);
    await persistDatabase(database);
  });
  writeQueue = operation.catch(() => undefined);
  await operation;
  return result;
}

export function requireJsonActor(database: JsonDatabase): JsonUser {
  const actor = database.users.find((user) => user.active);
  if (!actor) throw new Error("Chưa có người dùng hoạt động trong data/db.json.");
  return actor;
}

export function appendAudit(database: JsonDatabase, actorId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
  database.auditLogs.push({ id: createId(), actorId, action, entityType, entityId, metadata, createdAt: new Date().toISOString() });
}
