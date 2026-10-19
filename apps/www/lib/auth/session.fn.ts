import { createServerFn } from "@tanstack/react-start";
import {
  appendResponseHeader,
  getRequest,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { Effect } from "effect";
import { createRequestSession } from "@/lib/auth/session.server";
import { serverHandler } from "@/lib/server/fn";

/**
 * The visitor's session, answered to the browser without any credential. The
 * cookies that Better Auth set are appended to the answer, and no cache keeps it.
 */
export const readSessionClient = Effect.fn("www.auth.session.fn")(function* () {
  const readSession = yield* createRequestSession(getRequest());
  const session = yield* readSession;
  yield* Effect.sync(() => {
    setResponseHeader("cache-control", "private, no-store");
    for (const cookie of session.setCookies) {
      appendResponseHeader("set-cookie", cookie);
    }
  });
  return session.client;
});

/** The handler of the session server function, which the tests call directly. */
export const sessionHandler = serverHandler(() => readSessionClient());

/** The session of the current visitor, read by the page that needs it. */
export const sessionFn = createServerFn({ method: "GET" }).handler(
  sessionHandler
);
