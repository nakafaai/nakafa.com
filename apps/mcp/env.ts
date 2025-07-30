import { keys as core } from "@repo/next-config/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  extends: [core()],
  server: {
    REDIS_URL: z.string(),
  },
  client: {},
  runtimeEnv: {
    REDIS_URL: process.env.REDIS_URL,
  },
});
