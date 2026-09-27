import Fastify from "fastify";
import { plannerRoutes } from "./planner-routes.js";
import { PlannerError } from "./db/planner-store.js";
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
  householdSchema,
  catalogueQuerySchema,
  recipeCatalogueSchema,
  recipeFilterOptionsSchema,
  recipeDetailSchema,
  createRecipeSchema,
} from "@nosh/contracts";
import type { Store } from "./db/index.js";

export async function createApp(store: Store, development = false) {
  const app = Fastify({
    logger: !process.env.VITEST,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof PlannerError)
      return reply
        .status(error.statusCode)
        .send({ code: error.code, message: error.message });
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
  plannerRoutes(app, store);
  app.get(
    "/api/household",
    { schema: { response: { 200: householdSchema, 500: errorSchema } } },
    async () => store.household(),
  );
  app.put(
    "/api/household",
    {
      schema: {
        body: householdSchema,
        response: { 200: householdSchema, 400: errorSchema, 500: errorSchema },
      },
    },
    async (request) => store.saveHousehold(request.body),
  );

  app.get(
    "/api/recipes",
    { schema: { response: { 200: recipeSummariesSchema, 500: errorSchema } } },
    async () => ({ recipes: store.recipeSummaries() }),
  );

  app.get(
    "/api/recipes/catalogue",
    {
      schema: {
        querystring: catalogueQuerySchema,
        response: {
          200: recipeCatalogueSchema,
          400: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request) => store.recipeCatalogue(request.query),
  );

  app.get(
    "/api/recipes/filter-options",
    {
      schema: {
        response: { 200: recipeFilterOptionsSchema, 500: errorSchema },
      },
    },
    async () => store.recipeFilterOptions(),
  );

  app.get<{ Params: { id: string } }>(
    "/api/recipes/:id",
    {
      schema: {
        response: {
          200: recipeDetailSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const recipe = store.recipeDetail(request.params.id);
      if (!recipe)
        return reply
          .status(404)
          .send({ code: "NOT_FOUND", message: "Recipe not found." });
      return recipe;
    },
  );

  app.post(
    "/api/recipes",
    {
      schema: {
        body: createRecipeSchema,
        response: {
          201: recipeDetailSchema,
          400: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(store.createRecipe(request.body)),
  );

  return app;
}
