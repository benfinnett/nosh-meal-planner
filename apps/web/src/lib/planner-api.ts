import { z } from "zod";
import {
  plannerSchema,
  weekSchema,
  historySchema,
  templatesSchema,
  templateSchema,
  previewSchema,
} from "@nosh/contracts";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

export class PlannerApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// A failed request keeps its operation ID for an explicit retry in this session.
const pendingOperations = new Map<string, string>();
export async function plannerRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: object,
): Promise<T> {
  const key = JSON.stringify([path, method, body]);
  const isWrite = body && !path.endsWith("/preview");
  const operationId = isWrite
    ? (pendingOperations.get(key) ?? crypto.randomUUID())
    : undefined;
  if (operationId) pendingOperations.set(key, operationId);
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body
      ? JSON.stringify({ ...body, ...(operationId ? { operationId } : {}) })
      : undefined,
  });
  if (!response.ok) {
    if (response.status < 500) pendingOperations.delete(key);
    const error = await response.json().catch(() => ({}));
    throw new PlannerApiError(
      response.status,
      error.message ?? "Couldn’t save this change. Please try again.",
    );
  }
  const result = schema.parse(await response.json());
  pendingOperations.delete(key);
  return result;
}

export const fetchPlanner = () => plannerRequest("/planner", plannerSchema);
export const fetchWeek = (id: string) =>
  plannerRequest(`/weeks/${encodeURIComponent(id)}`, weekSchema);
export const fetchHistory = (offset = 0) =>
  plannerRequest(`/weeks?offset=${offset}`, historySchema);
export const fetchTemplates = () =>
  plannerRequest("/templates", templatesSchema);
export const fetchTemplate = (id: string) =>
  plannerRequest(`/templates/${encodeURIComponent(id)}`, templateSchema);
export const previewAutofill = (id: string, expectedRevision: number) =>
  plannerRequest(`/weeks/${id}/autofill/preview`, previewSchema, "POST", {
    expectedRevision,
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
  });

export function usePlannerWrite() {
  const client = useQueryClient();
  const pending = useIsMutating({ mutationKey: ["planner-write"] }) > 0;
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationKey: ["planner-write"],
    mutationFn: async (run: () => Promise<unknown>) => run(),
  });
  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (client.isMutating({ mutationKey: ["planner-write"] })) return undefined;
    setError("");
    try {
      const value = (await mutation.mutateAsync(action)) as T;
      await client.invalidateQueries({ queryKey: ["planner"] });
      return value;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn’t save. Please try again.",
      );
      if (reason instanceof PlannerApiError && reason.status === 409)
        await client.invalidateQueries({ queryKey: ["planner"] });
      return undefined;
    }
  }
  return { run, pending, error, clearError: () => setError("") };
}
