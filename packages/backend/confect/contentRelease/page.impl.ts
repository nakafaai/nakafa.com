import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/contentRelease/page.spec";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import { Effect, Layer } from "effect";

const catalog = FunctionImpl.make(
  databaseSchema,
  spec,
  "catalog",
  Effect.fn("contentRelease.page.catalog")(function* () {
    return yield* readPageCatalog().pipe(Effect.provide(publicationLayer));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(catalog),
  GroupImpl.finalize
);
