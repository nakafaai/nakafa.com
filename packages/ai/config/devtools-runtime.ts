import { devtoolsKeys } from "@repo/ai/keys";

/** Allows AI SDK DevTools only in an explicitly enabled local runtime. */
export function isAiSdkDevToolsTelemetryEnabled() {
  const env = devtoolsKeys();

  if (env.AI_SDK_DEVTOOLS !== "true" || env.NODE_ENV === "production") {
    return false;
  }

  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development";
}
