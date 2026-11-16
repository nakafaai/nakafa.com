import { lazy } from "@repo/design-system/lib/lazy";
import { Option } from "effect";
import { Suspense } from "react";
import { AnalyticsRuntime } from "@/components/analytics/runtime";
import { useLiveSession } from "@/components/providers/live";

const IslandAnalytics = lazy(() =>
  import("@/components/analytics/island").then((loaded) => ({
    default: loaded.IslandAnalytics,
  }))
);

/**
 * The analytics of a static page: a visitor's at once, and a signed-in reader's
 * once their live session opens, read through that session's own client.
 */
export function PageAnalytics() {
  const client = useLiveSession((state) => state.client);
  const sessionId = useLiveSession((state) => state.sessionId);
  const isSessionPending = useLiveSession((state) => state.isPending);
  if (isSessionPending) {
    return null;
  }
  if (Option.isNone(client) || sessionId === null) {
    return <AnalyticsRuntime account={null} isAccountPending={false} />;
  }
  return (
    <Suspense fallback={null}>
      <IslandAnalytics client={client.value} />
    </Suspense>
  );
}
