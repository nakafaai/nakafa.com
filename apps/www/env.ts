import { convexKeys, convexSiteKeys } from "@repo/backend/keys";
import { publicationKeys, siteUrlKeys } from "@repo/next-config/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { Schema } from "effect";

/**
 * Validates environment values consumed by `www` runtime modules.
 *
 * Package-specific integrations such as AI clients, CAS, Polar, and Convex
 * backend functions keep their own env contracts at the capability that reads
 * those values.
 */
export const env = createEnv({
  extends: [publicationKeys(), siteUrlKeys(), convexKeys(), convexSiteKeys()],
  client: {
    NEXT_PUBLIC_AKSARA_PREVIEW_CHILD: Schema.toStandardSchemaV1(
      Schema.UndefinedOr(Schema.Literals(["true", "false"]))
    ),
  },
  runtimeEnv: {
    NEXT_PUBLIC_AKSARA_PREVIEW_CHILD:
      process.env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD,
  },
});
