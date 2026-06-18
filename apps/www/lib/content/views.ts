import { applyContentRuntimeCache } from "@/lib/content/cache";
import { fetchRuntimeContentRoute } from "@/lib/content/runtime/routes";

/** Reads the persisted graph content ID for a public route projection. */
export async function getRuntimeContentViewId(
  args: Parameters<typeof fetchRuntimeContentRoute>[0]
) {
  "use cache";

  applyContentRuntimeCache();

  const route = await fetchRuntimeContentRoute(args);

  return route?.content_id ?? null;
}
