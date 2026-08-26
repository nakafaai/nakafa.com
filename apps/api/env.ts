import {
  agentDeploymentKeys,
  agentOriginKeys,
  apiEdgeKeys,
  convexKeys,
  convexSiteKeys,
} from "@repo/backend/keys";
import { contentApiKeys, contentRuntimeKeys } from "@repo/next-config/keys";
import { createEnv } from "@t3-oss/env-nextjs";

/** Validates only the API app runtime values used by its route adapters. */
export const env = createEnv({
  extends: [
    contentApiKeys(),
    contentRuntimeKeys(),
    agentDeploymentKeys(),
    agentOriginKeys(),
    convexKeys(),
    convexSiteKeys(),
    apiEdgeKeys(),
  ],
  server: {},
  client: {},
  runtimeEnv: {},
});
