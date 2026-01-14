import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const keys = () =>
  createEnv({
    server: {
      INTERNAL_CONTENT_API_KEY: z.string().min(1),
    },
    runtimeEnv: {
      INTERNAL_CONTENT_API_KEY: process.env.INTERNAL_CONTENT_API_KEY,
    },
  });
