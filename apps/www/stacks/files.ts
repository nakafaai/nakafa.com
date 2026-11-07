import {
  providers as cloudflareProviders,
  state as cloudflareState,
  R2,
} from "@alchemy.run/cloudflare";
import { RemovalPolicy, Stack } from "alchemy";
import { Effect } from "effect";

/** One day, the age at which R2 aborts a multipart upload that never completed. */
const DAY_SECONDS = 86_400;

/** The CORS rule of a bucket: the origins whose pages upload with a presigned PUT and read with a GET, and the headers they send and read back. */
const corsRules = (allowedOrigins: string[]) => [
  {
    allowedHeaders: ["content-type", "range"],
    allowedMethods: ["GET" as const, "HEAD" as const, "PUT" as const],
    allowedOrigins,
    exposeHeaders: ["content-length", "content-type"],
    maxAgeSeconds: 3600,
  },
];

/** R2 aborts a multipart upload left unfinished for a day. */
const LIFECYCLE_RULES = [
  {
    abortMultipartUploadsTransition: {
      condition: { maxAge: DAY_SECONDS, type: "Age" as const },
    },
    id: "abort-unfinished-uploads",
  },
];

/**
 * The file buckets (ADR 0028). The operator deploys this stack once from a local shell with the Alchemy OAuth
 * profile, as `stacks/github.ts` is deployed, because the deploy token of the workflow holds no R2 permission and
 * no Worker binds a bucket: Convex signs every address with a bucket-scoped token, and the browser uploads and
 * downloads straight from R2.
 *
 * `nakafa-files` serves production, nakafa.com and every School host under it. `nakafa-files-staging` serves the
 * dev Convex deployment, which staging and local development share. Both are private, with no public access and no
 * custom domain, and the stack keeps them when it drops them. The bucket-scoped token and the Convex values
 * (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`) are set by the operator once, without
 * printing them, as `packages/backend/AGENTS.md` sets every Convex value.
 */
export default Stack(
  "NakafaFiles",
  { providers: cloudflareProviders(), state: cloudflareState() },
  Effect.gen(function* () {
    yield* R2.Bucket("ProductionFiles", {
      cors: corsRules(["https://nakafa.com", "https://*.nakafa.com"]),
      lifecycleRules: LIFECYCLE_RULES,
      name: "nakafa-files",
    }).pipe(RemovalPolicy.retain());
    yield* R2.Bucket("StagingFiles", {
      cors: corsRules([
        "https://staging.nakafa.com",
        "http://localhost:3000",
        "http://*.localhost:3000",
      ]),
      lifecycleRules: LIFECYCLE_RULES,
      name: "nakafa-files-staging",
    }).pipe(RemovalPolicy.retain());
  })
);
