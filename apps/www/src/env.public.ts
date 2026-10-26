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
      // The public VAPID key that browsers subscribe to push with; unset while push is not set up.
      VITE_WEB_PUSH_PUBLIC_KEY: Schema.UndefinedOr(
        Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]+$/u))
      ),
    },
    {
      VITE_AKSARA_PREVIEW_CHILD: import.meta.env.VITE_AKSARA_PREVIEW_CHILD,
      VITE_WEB_PUSH_PUBLIC_KEY: import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY,
    }
  ),
};
