import "server-only";

import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Reads the exact integrity-checked active content release identity. */
export const readActiveContentIdentity = Effect.fn(
  "NakafaContent.readActiveContentIdentity"
)(function* () {
  return yield* readRuntimeQuery("contentRelease.runtime.active.read", () =>
    fetchRuntimeQuery(api.contentRelease.runtime.active.read, {})
  );
});
