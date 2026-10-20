import "@tanstack/react-start/server-only";
import { appendResponseHeader, getRequest } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { createRequestSession } from "@/lib/auth/session.server";

/** One read of a request's session, as `createRequestSession` memoizes it. */
type RequestSessionRead = Effect.Success<
  ReturnType<typeof createRequestSession>
>;

/**
 * The session read of each request. The Request object is the identity of one
 * request, so an entry leaves with its request and never reaches another visitor.
 *
 * Stopgap: this WeakMap is the school's own per-request memo until the request
 * session seam of lane L0-6 owns it. Replace it with that seam when it lands, and
 * delete this module then.
 */
const reads = new WeakMap<Request, RequestSessionRead>();

/**
 * The session of the current request, read once. The first reader makes the read
 * and appends its Set-Cookie values to the answer, so a sliding refresh reaches the
 * browser. Every later reader of the same request gets the same session, so one
 * document reads the session once however many of its routes need it.
 */
export const readCurrentSession = Effect.fn("www.tenant.currentSession")(
  function* () {
    const request = getRequest();
    const cached = reads.get(request);
    if (cached !== undefined) {
      return yield* cached;
    }
    const read = yield* createRequestSession(request);
    reads.set(request, read);
    const session = yield* read;
    yield* Effect.sync(() => {
      for (const cookie of session.setCookies) {
        appendResponseHeader("set-cookie", cookie);
      }
    });
    return session;
  }
);
