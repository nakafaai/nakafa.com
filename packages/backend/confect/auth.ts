import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

export default {
  providers: [
    getAuthConfigProvider({
      ...(process.env.JWKS === undefined ? {} : { jwks: process.env.JWKS }),
    }),
  ],
} satisfies AuthConfig;
