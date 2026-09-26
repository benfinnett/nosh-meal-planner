import { z } from "zod";
import { createApp } from "./app.js";
import { openStore } from "./db/index.js";

const config = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().default("127.0.0.1"),
    DATABASE_PATH: z.string().min(1).default("./data/nosh.sqlite"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  })
  .parse(process.env);

const store = openStore(config.DATABASE_PATH);

try {
  store.seed();
} catch (error) {
  store.close();
  throw error;
}

const app = await createApp(store, config.NODE_ENV === "development");

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });

await app.listen({ port: config.PORT, host: config.HOST });
