import { openStore } from "./index.js";
import Database from "better-sqlite3";
import { existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/nosh.sqlite");

if (process.argv.includes("--reset")) {
  if (existsSync(databasePath)) {
    const database = new Database(databasePath);

    try {
      const checkpoint = database.pragma("wal_checkpoint(TRUNCATE)") as {
        busy: number;
      }[];

      if (checkpoint.some((result) => result.busy !== 0))
        throw new Error("Database is busy. Stop the app before resetting.");
    } finally {
      database.close();
    }

    const backup = `${databasePath}.backup-${Date.now()}`;
    renameSync(databasePath, backup);
    console.log(`Previous database preserved at ${backup}`);
  }
}

const store = openStore(databasePath);

try {
  store.seed();
  console.log(`Seed complete: ${store.recipeCount()} recipes`);
} finally {
  store.close();
}
