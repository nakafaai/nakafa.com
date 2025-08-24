import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const keys = () =>
  createEnv({
    server: {
      CONVEX_URL: z.string(),
      CONVEX_SITE_URL: z.url(),
    },
    client: {
      NEXT_PUBLIC_CONVEX_URL: z.string(),
    },
    runtimeEnv: {
      CONVEX_URL: process.env.CONVEX_URL,
      CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    },
  });
