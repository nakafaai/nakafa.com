import { R2 } from "@alchemy.run/cloudflare";
import { PRODUCTION_DEPLOY_STAGE } from "@repo/utilities/stage";
import { RemovalPolicy } from "alchemy";
import { Effect } from "effect";
import { workerName } from "#www/deploy/stage";

/** The private bucket that keeps every file Nakafa stores, named per stage as its Workers are. */
export const filesBucketName = (stage: string) => workerName("files", stage);

/** One day, the age at which R2 aborts a multipart upload that never completed. */
const DAY_SECONDS = 86_400;

/**
 * The origins whose pages upload to the bucket and read from it with an address Convex signed: production's
 * nakafa.com and every School host under it, and staging, which local development shares through the dev Convex
 * deployment.
 */
const filesOrigins = (stage: string) =>
  stage === PRODUCTION_DEPLOY_STAGE
    ? ["https://nakafa.com", "https://*.nakafa.com"]
    : [`https://${stage}.nakafa.com`, "http://localhost:3000"];

/**
 * The file bucket of a stage (ADR 0028): private, with no public access and no custom domain, so a file opens
 * only at an address Convex signed after its access check. Browsers upload and download straight from R2, which
 * the CORS rule allows for the stage's own pages, so no byte passes through a Worker. A multipart upload left
 * unfinished is aborted after a day. Production keeps the bucket when the stack drops it.
 */
export const deployFiles = Effect.fn("deploy.files")(function* (
  stage: string,
  isProduction: boolean
) {
  return yield* R2.Bucket("Files", {
    cors: [
      {
        allowedHeaders: ["content-type", "range"],
        allowedMethods: ["GET", "HEAD", "PUT"],
        allowedOrigins: filesOrigins(stage),
        exposeHeaders: ["content-length", "content-type"],
        maxAgeSeconds: 3600,
      },
    ],
    lifecycleRules: [
      {
        abortMultipartUploadsTransition: {
          condition: { maxAge: DAY_SECONDS, type: "Age" },
        },
        id: "abort-unfinished-uploads",
      },
    ],
    name: filesBucketName(stage),
  }).pipe(RemovalPolicy.retain(isProduction));
});
