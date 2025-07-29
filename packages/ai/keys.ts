import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      AI_GATEWAY_API_KEY: z.string(),
    },
    runtimeEnv: {
      AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    },
  });
