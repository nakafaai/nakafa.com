import type { ConvexReactClient } from "convex/react";
import { use } from "react";
import {
  ConvexSessionCredentials,
  ConvexSessionRelease,
} from "@/components/providers/convex";
import { ConvexAuthContext } from "@/lib/auth/convex";

/**
 * Hands the page's one Convex client its Better Auth credentials. It mounts once
 * the store holds a client, and it lives in this module, which a visitor's page
 * never loads.
 */
export function LiveCredentials({ client }: { client: ConvexReactClient }) {
  const store = use(ConvexAuthContext);
  if (!store) {
    throw new TypeError("LiveCredentials must be used within PageProviders");
  }
  return (
    <>
      <ConvexSessionCredentials client={client} store={store} />
      <ConvexSessionRelease client={client} />
    </>
  );
}
