import { convexKeys, convexSiteKeys } from "@repo/backend/public";
import { readEnvironment } from "@repo/utilities/env";
import { Schema } from "effect";

/**
 * Public values that browser components and server code both read. This module
 * reads no server key, so a client bundle never evaluates one.
 */
export const clientEnv = {
  ...convexKeys(),
  ...convexSiteKeys(),
  ...readEnvironment(
    {
      VITE_AKSARA_PREVIEW_CHILD: Schema.UndefinedOr(
        Schema.Literals(["true", "false"])
      ),
      VITE_VERCEL_DEPLOYMENT_ID: Schema.UndefinedOr(Schema.String),
    },
    {
      VITE_AKSARA_PREVIEW_CHILD: import.meta.env.VITE_AKSARA_PREVIEW_CHILD,
      VITE_VERCEL_DEPLOYMENT_ID: import.meta.env.VITE_VERCEL_DEPLOYMENT_ID,
    }
  ),
};
