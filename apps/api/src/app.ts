import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import {
  healthSchema,
  statusSchema,
  errorSchema,
  recipeSummariesSchema,
} from "@nosh/contracts";
import type { Store } from "./db/index.js";

export async function createApp(store: Store, development = false) {
  const app = Fastify({
    logger: !process.env.VITEST,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const invalid =
      typeof error === "object" && error !== null && "validation" in error;
    return reply.status(invalid ? 400 : 500).send({
      code: invalid ? "INVALID_INPUT" : "INTERNAL_ERROR",
      message: invalid
        ? "Please check the supplied values."
        : "Something went wrong. Please try again.",
    });
  });

  if (development) {
    await app.register(swagger, {
      openapi: { info: { title: "Nosh API", version: "0.1.0" } },
      transform: jsonSchemaTransform,
    });
    await app.register(swaggerUi, { routePrefix: "/api/docs" });
  }

  app.get(
    "/api/health/live",
    { schema: { response: { 200: healthSchema } } },
    async () => ({ status: "ok" as const }),
  );

  app.get(
    "/api/health/ready",
    { schema: { response: { 200: healthSchema, 503: errorSchema } } },
    async (_, reply) => {
      try {
        store.recipeCount();
        return { status: "ok" as const };
      } catch {
        return reply
          .status(503)
          .send({ code: "NOT_READY", message: "Storage is unavailable." });
      }
    },
  );

  if (development)
    app.get(
      "/api/dev/status",
      { schema: { response: { 200: statusSchema } } },
      async () => ({
        status: "ready" as const,
        recipeCount: store.recipeCount(),
      }),
    );

  app.addHook("onClose", async () => store.close());

  app.get(
    "/api/recipes",
    { schema: { response: { 200: recipeSummariesSchema, 500: errorSchema } } },
    async () => ({ recipes: store.recipeSummaries() }),
  );

  return app;
}
