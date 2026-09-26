import { z } from "zod";

// Public HTTP shapes only; development consumers watch these sources directly.
export const healthSchema = z.object({ status: z.literal("ok") });

export const statusSchema = z.object({
  status: z.literal("ready"),
  recipeCount: z.number().int().nonnegative(),
});

export const errorSchema = z.object({ code: z.string(), message: z.string() });

export type SystemStatus = z.infer<typeof statusSchema>;
