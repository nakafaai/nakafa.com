import { ConvexHttpClient } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

/** Fetches one public Convex query with framework-safe client settings. */
export function fetchConvexRuntimeQuery<
  Query extends FunctionReference<"query">,
>(
  convexUrl: string,
  query: Query,
  args: FunctionArgs<Query>
): Promise<FunctionReturnType<Query>> {
  const client = new ConvexHttpClient(convexUrl, {
    fetch: fetchNoStore,
    logger: false,
  });

  return client.query(query, args);
}

/** Forces runtime read-model queries to bypass framework fetch caching. */
const fetchNoStore: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    cache: "no-store",
  });
