import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { readAgentArticleTaxonomy } from "@repo/backend/confect/contentRelease/article/agent";
import spec from "@repo/backend/confect/contentRelease/article/internal.spec";
import { Effect, Layer } from "effect";

const readAgentTaxonomy = FunctionImpl.make(
  databaseSchema,
  spec,
  "readAgentTaxonomy",
  Effect.fn("contentRelease.article.internal.readAgentTaxonomy")(function* ({
    appLocale,
  }) {
    const ctx = yield* QueryCtxService;
    return yield* readAgentArticleTaxonomy(ctx, appLocale);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(readAgentTaxonomy),
  GroupImpl.finalize
);
