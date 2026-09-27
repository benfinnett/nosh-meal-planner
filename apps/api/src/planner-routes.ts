import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  plannerSchema,
  weekSchema,
  historySchema,
  templateSchema,
  templatesSchema,
  startWeekSchema,
  addMealSchema,
  changeMealSchema,
  writeSchema,
  checkShoppingSchema,
  saveTemplateSchema,
  renameTemplateSchema,
  previewRequestSchema,
  previewSchema,
  applyAutofillSchema,
} from "@nosh/contracts";
import type { Store } from "./db/index.js";

export function plannerRoutes(instance: FastifyInstance, store: Store) {
  const app = instance.withTypeProvider<ZodTypeProvider>();
  const planner = store.planner;
  const idParams = z.object({ id: z.string().min(1) });
  const mealParams = idParams.extend({ mealId: z.string().min(1) });
  app.get(
    "/api/planner",
    { schema: { response: { 200: plannerSchema } } },
    async () => planner.overview(),
  );
  app.get(
    "/api/weeks",
    {
      schema: {
        querystring: z.object({
          offset: z.coerce.number().int().min(0).default(0),
        }),
        response: { 200: historySchema },
      },
    },
    async (req) => planner.history(req.query.offset),
  );
  app.post(
    "/api/weeks",
    { schema: { body: startWeekSchema, response: { 200: weekSchema } } },
    async (req) => planner.start(req.body),
  );
  app.get(
    "/api/weeks/:id",
    { schema: { params: idParams, response: { 200: weekSchema } } },
    async (req) => planner.week(req.params.id),
  );
  app.post(
    "/api/weeks/:id/meals",
    {
      schema: {
        params: idParams,
        body: addMealSchema,
        response: { 200: weekSchema },
      },
    },
    async (req) => planner.addMeal(req.params.id, req.body),
  );
  app.patch(
    "/api/weeks/:id/meals/:mealId",
    {
      schema: {
        params: mealParams,
        body: changeMealSchema,
        response: { 200: weekSchema },
      },
    },
    async (req) =>
      planner.changeMeal(req.params.id, req.params.mealId, req.body),
  );
  app.delete(
    "/api/weeks/:id/meals/:mealId",
    {
      schema: {
        params: mealParams,
        body: writeSchema,
        response: { 200: weekSchema },
      },
    },
    async (req) =>
      planner.changeMeal(req.params.id, req.params.mealId, req.body),
  );
  app.put(
    "/api/weeks/:id/shopping",
    {
      schema: {
        params: idParams,
        body: checkShoppingSchema,
        response: { 200: weekSchema },
      },
    },
    async (req) => planner.check(req.params.id, req.body),
  );
  app.get(
    "/api/templates",
    { schema: { response: { 200: templatesSchema } } },
    async () => planner.templates(),
  );
  app.get(
    "/api/templates/:id",
    { schema: { params: idParams, response: { 200: templateSchema } } },
    async (req) => planner.template(req.params.id),
  );
  app.post(
    "/api/templates",
    { schema: { body: saveTemplateSchema, response: { 200: templateSchema } } },
    async (req) => planner.saveTemplate(req.body),
  );
  app.patch(
    "/api/templates/:id",
    {
      schema: {
        params: idParams,
        body: renameTemplateSchema,
        response: { 200: templateSchema },
      },
    },
    async (req) => planner.renameTemplate(req.params.id, req.body),
  );
  app.delete(
    "/api/templates/:id",
    {
      schema: {
        params: idParams,
        body: writeSchema,
        response: { 200: z.object({ deleted: z.boolean() }) },
      },
    },
    async (req) => planner.deleteTemplate(req.params.id, req.body),
  );
  app.post(
    "/api/weeks/:id/autofill/preview",
    {
      schema: {
        params: idParams,
        body: previewRequestSchema,
        response: { 200: previewSchema },
      },
    },
    async (req) =>
      planner.preview(req.params.id, req.body.expectedRevision, req.body.seed),
  );
  app.post(
    "/api/weeks/:id/autofill/apply",
    {
      schema: {
        params: idParams,
        body: applyAutofillSchema,
        response: { 200: weekSchema },
      },
    },
    async (req) => planner.apply(req.params.id, req.body),
  );
}
