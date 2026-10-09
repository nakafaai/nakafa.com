import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** One signed article selected for partner API hydration. */
const articleApiEntryValidator = Schema.Struct({
  appLocale: appLocaleValidator,
  publicPath: Schema.String,
});

/** Bounded article partner page selected from the current catalog. */
export const articleApiPageValidator = Schema.Struct({
  activeReleaseId: Schema.String,
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.mutable(Schema.Array(articleApiEntryValidator)),
});

/** Bounded article taxonomy returned to the protected agent transport. */
export const agentArticleTaxonomyValidator = Schema.Struct({
  categories: Schema.mutable(Schema.Array(Schema.String)),
  managed: Schema.Boolean,
});
