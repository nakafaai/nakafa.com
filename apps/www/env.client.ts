import { convexKeys, convexSiteKeys } from "@repo/backend/keys";
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
      NEXT_PUBLIC_AKSARA_PREVIEW_CHILD: Schema.UndefinedOr(
        Schema.Literals(["true", "false"])
      ),
    },
    {
      NEXT_PUBLIC_AKSARA_PREVIEW_CHILD:
        process.env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD,
    }
  ),
};
