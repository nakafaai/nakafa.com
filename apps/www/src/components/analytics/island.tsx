import type { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { AnalyticsRuntime } from "@/components/analytics/runtime";
import { useViewer } from "@/lib/identity/client";

/** The analytics of a page inside a Convex provider, counted under the signed-in account. */
export function AccountAnalytics() {
  const account = useViewer((state) => state.account);
  const isAccountPending = useViewer((state) => state.isPending);
  return (
    <AnalyticsRuntime account={account} isAccountPending={isAccountPending} />
  );
}

/** A static page's analytics for a signed-in reader, inside their live session's Convex client. */
export function IslandAnalytics({ client }: { client: ConvexReactClient }) {
  return (
    <ConvexProvider client={client}>
      <AccountAnalytics />
    </ConvexProvider>
  );
}
