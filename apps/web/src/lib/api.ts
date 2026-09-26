import { statusSchema } from "@nosh/contracts";

export async function fetchStatus() {
  const response = await fetch("/api/dev/status");
  if (!response.ok)
    throw new Error(
      "The API is unavailable. Check that the development server is running.",
    );

  const parsed = statusSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("The API returned an unexpected response.");

  return parsed.data;
}
