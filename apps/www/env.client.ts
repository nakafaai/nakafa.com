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

/**
 * Whether this page is the preview child of Aksara. The auth session and the
 * analytics consent both read this one value, so their providers agree.
 */
export const isAksaraPreviewChild =
  clientEnv.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD === "true";
