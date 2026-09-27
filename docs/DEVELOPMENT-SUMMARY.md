# Development Summary

## Architecture Decisions

| Area          | Decision                                                                                                     | Why this choice / why not the alternative                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Web           | React/Vite with a mobile-first responsive interface.                                                         | Fits the existing TypeScript skills and fast local development; SSR was not justified for this private planner.                                 |
| API           | Fastify owns HTTP routes and is the only layer that accesses storage.                                        | Keeps boundaries explicit and lightweight; a heavier service framework would add complexity without a current scaling need.                     |
| Contracts     | Zod DTOs are shared between web and API; database rows remain private to the API.                            | Validates transport data at the boundary; sharing database models would couple clients to storage details.                                      |
| Domain        | Meal-planning logic is kept in pure functions where practical for independent testing.                       | Makes matching and quantity rules predictable; embedding logic in route handlers would be harder to test and evolve.                            |
| Storage       | SQLite with Drizzle.                                                                                         | Appropriate for a single-instance household app with transactions and simple operations; a hosted database is deferred until scale requires it. |
| Deployment    | Docker Compose supports local production-like operation with a persistent named volume and readiness checks. | Simple, reproducible, and sufficient for local beta use; Kubernetes would add operational cost before there is a multi-instance requirement.    |
| UI primitives | Radix UI was evaluated initially, then replaced with Base UI because Base UI is better maintained.           | Base UI better matches the maintenance needs of this project; continuing with Radix would preserve a less favourable support position.          |
| Pricing data  | Supermarket pricing is not treated as a dependable feature input.                                            | Supermarkets intentionally do not publish reliable product-level pricing; estimates would create misleading product behaviour.                  |

## Design Choices

- Recipes, dated weekly plans, templates, shopping aggregation, dietary preferences, and archived read-only plans are the primary product journeys.
- Recipe snapshots preserve the historical meaning of existing plans when catalogue data changes.
- Planner writes use revisions and operation IDs to protect against stale updates and duplicate retries.
- Exact rational quantities distinguish compatible units, incompatible units, and unspecified amounts.
- The interface prioritises labelled controls, visible focus, responsive layouts, validation feedback, recovery states, and reduced-motion support.
- Brand styling uses the Nosh palette, local fonts/assets, and a warm, practical tone.

## Issues Found

- Public deployment has no authentication, authorisation, tenant isolation, rate limits, or abuse controls.
- Recipe detail currently displays selected servings but adding to a week uses household size instead.
- Dietary filtering semantics differ between discovery (OR matching) and autofill (all selected labels required).
- Malformed JSON and oversized request bodies return `500` instead of appropriate client errors.
- Planner idempotency records retain full responses indefinitely, causing unbounded storage growth.
- The runtime API image includes unnecessary source/tooling and environment files.
- The frontend ships a large eager JavaScript bundle without explicit compression or asset caching policy.
- Recovery operations lack automated off-host backups, restore rehearsals, alerts, SLOs, and a migration rollback process.
- README/specification content has drifted from the implemented routes and data model.

## Next Steps

1. Decide and document serving and dietary behaviour; add regression tests for both.
2. Preserve client-error status codes and add malformed-body, retry, and stale-writer tests.
3. Define operation retention and workload limits; bound catalogue, template, and weekly-plan growth.
4. Produce a minimal runtime image with safe environment handling, compression, caching, and route splitting.
5. For any hosted release, add an authenticated access boundary, ownership/isolation rules, HTTPS, monitoring, backups, restore drills, and abuse controls.
6. Bring the README and authoritative design/migration documents into sync with the implemented scope.
7. Add accessibility automation and manual checks across the agreed browser support matrix.
