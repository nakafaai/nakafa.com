import { keys as backendKeys } from "@repo/backend/keys";
import { keys as core } from "@repo/next-config/keys";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  extends: [core(), backendKeys()],
  server: {},
  client: {},
  runtimeEnv: {},
});
