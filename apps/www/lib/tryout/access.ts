import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { Data } from "effect";

type TryoutStartAccess = FunctionReturnType<
  typeof api.tryouts.queries.access.getStartAccess
>;

export type TryoutStartDialogKind = TryoutStartAccess["kind"];

/** Typed client failure for one try-out mutation or checkout request. */
export class TryoutClientRequestError extends Data.TaggedError(
  "TryoutClientRequestError"
)<{
  readonly cause: unknown;
}> {}

/** Maps an unknown client request rejection into the local Effect channel. */
export function toTryoutClientRequestError(cause: unknown) {
  return new TryoutClientRequestError({ cause });
}

/** Returns whether a start mutation authoritatively requires Nakafa Pro. */
export function isTryoutAccessRequired(error: TryoutClientRequestError) {
  const cause = error.cause;

  if (!(cause instanceof ConvexError)) {
    return false;
  }

  const data = cause.data;

  if (typeof data !== "object" || data === null || !("code" in data)) {
    return false;
  }

  return data.code === "TRYOUT_ACCESS_REQUIRED";
}

/** Resolves the visible dialog while allowing mutation authority to override. */
export function getTryoutStartDialogKind(
  access: TryoutStartAccess | undefined,
  forceUpgrade: boolean
): TryoutStartDialogKind {
  if (forceUpgrade) {
    return "upgrade-required";
  }

  return access?.kind ?? "free-attempt";
}
