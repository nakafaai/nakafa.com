import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { searchSections } from "@repo/backend/confect/contents/sections/search";
import spec from "@repo/backend/confect/contents/sections/search.spec";
import { GatewayLive } from "@repo/backend/confect/gateway/live";
import { Effect, Layer } from "effect";

const search = FunctionImpl.make(
  databaseSchema,
  spec,
  "search",
  Effect.fn("contents.sections.search.search")(function* (args) {
    return yield* searchSections(args).pipe(Effect.provide(GatewayLive));
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(search),
  GroupImpl.finalize
);
