import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import type BetterSqlite3 from "better-sqlite3"
import Database from "better-sqlite3"
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"

export interface DbInstance {
	db: BetterSQLite3Database<typeof schema>
	sqlite: BetterSqlite3.Database
}

export function createDb(dbPath: string): DbInstance {
	// Ensure directory exists
	mkdirSync(dirname(dbPath), { recursive: true })

	const sqlite = new Database(dbPath)

	// Enable WAL mode for better concurrency
	sqlite.pragma("journal_mode = WAL")
	sqlite.pragma("synchronous = NORMAL")
	sqlite.pragma("foreign_keys = ON")
	sqlite.pragma("busy_timeout = 5000")

	const db = drizzle(sqlite, { schema })

	return { db, sqlite }
}

export type AppDatabase = DbInstance["db"]
