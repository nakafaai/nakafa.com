import { MiddlewareSpec } from "@confect/core";
import type { Session } from "@repo/backend/confect/auth/session";
import { AuthReadError } from "@repo/backend/confect/auth/spec";

/** Resolves the Better Auth session once for each covered invocation. */
export default class SessionMiddleware extends MiddlewareSpec.MiddlewareSpec<
  SessionMiddleware,
  {
    provides: Session;
  }
>()("Session", {
  error: () => AuthReadError,
  functionTypes: {
    query: true,
    mutation: true,
    action: true,
  },
}) {}
