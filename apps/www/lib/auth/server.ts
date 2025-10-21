import { getStaticAuth } from "@convex-dev/better-auth";
import { getToken as getTokenNextjs } from "@convex-dev/better-auth/nextjs";
import { createAuth } from "@repo/backend/convex/auth";

export function getToken() {
  getStaticAuth(createAuth);
  return getTokenNextjs(createAuth);
}
