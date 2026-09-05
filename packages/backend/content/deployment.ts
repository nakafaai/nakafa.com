import { Schema } from "effect";

/** Production deployment identity shared by trusted content boundaries. */
export const CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT = "dapper-antelope-269";

const ProtectedVercelIdentity = Schema.Struct({
  deployment: Schema.String.check(Schema.isPattern(/^dpl_[A-Za-z0-9]+$/)),
  environment: Schema.Literal("production"),
  git: Schema.Struct({
    branch: Schema.Literal("main"),
    commit: Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/)),
    owner: Schema.Literal("nakafaai"),
    provider: Schema.Literal("github"),
    repository: Schema.Literal("nakafa.com"),
  }),
  marker: Schema.Literal("1"),
  project: Schema.Literal("prj_QfxvXBST46wuSTOXPn4PE32NqbF4"),
  target: Schema.Literal("production"),
});

/** Recognizes the one protected production host before granting content access. */
export const isProtectedProduction = Schema.is(ProtectedVercelIdentity);
