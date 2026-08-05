import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

type CurriculumPageArgs = FunctionArgs<
  typeof api.contents.queries.runtime.getCurriculumPage
>;

/**
 * Reads a curriculum lesson from Convex through a Promise boundary for static RSCs.
 *
 * This avoids starting Effect's runtime before Next.js observes uncached data
 * during prerender. See https://nextjs.org/docs/messages/next-prerender-current-time.
 */
export function fetchRuntimeCurriculumPage(args: CurriculumPageArgs) {
  return fetchRuntimeQuery(
    api.contents.queries.runtime.getCurriculumPage,
    args
  );
}

/** Reads a curriculum lesson from the Convex content runtime model. */
export const getRuntimeCurriculumPage = Effect.fn(
  "www.contentRuntime.curriculumLesson"
)(function* (args: CurriculumPageArgs) {
  return yield* readRuntimeQuery("getCurriculumPage", () =>
    fetchRuntimeCurriculumPage(args)
  );
});
