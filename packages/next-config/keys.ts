import { vercel } from "@t3-oss/env-core/presets-zod";
import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const keys = () =>
  createEnv({
    extends: [vercel()],
    server: {
      ANALYZE: z.string().optional(),
      // Added by Vercel
      NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
      INTERNAL_CONTENT_API_KEY: z.string(),
    },
    client: {
      NEXT_PUBLIC_VERSION: z.string(),
      NEXT_PUBLIC_APP_URL: z.url(),
      NEXT_PUBLIC_API_URL: z.url().optional(),
      NEXT_PUBLIC_MCP_URL: z.url(),
    },
    runtimeEnv: {
      INTERNAL_CONTENT_API_KEY: process.env.INTERNAL_CONTENT_API_KEY,
      ANALYZE: process.env.ANALYZE,
      NEXT_PUBLIC_VERSION: process.env.NEXT_PUBLIC_VERSION,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_MCP_URL: process.env.NEXT_PUBLIC_MCP_URL,
    },
  });
