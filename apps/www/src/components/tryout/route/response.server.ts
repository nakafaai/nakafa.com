import { setResponseHeader } from "@tanstack/react-start/server";
import { Effect } from "effect";

/**
 * Keeps the answer of a learner's own try-out document out of every cache, as its
 * page's personal headers do, so a shared cache never serves one learner's progress
 * to another. The readers that answer such a document run it first.
 */
export const keepPersonalResponse = Effect.sync(() => {
  setResponseHeader("cache-control", "private, no-store");
});
