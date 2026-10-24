import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import {
  getRequest,
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { Effect } from "effect";
import { readSessionMemo } from "@/lib/auth/session.server";
import { serverHandler } from "@/lib/server/fn";
import type { SchoolFrameInput } from "@/lib/tenant/frame.functions";
import { readSchoolFrame, SchoolReadsLive } from "@/lib/tenant/read";

/**
 * The school frame of one request, answered with no cache. The school layout
 * calls it before each navigation into a school, and the server render calls it
 * in process, so both read the same decision.
 */
const readFrame = Effect.fn("www.tenant.frame")(function* (
  input: typeof SchoolFrameInput.Type
) {
  yield* Effect.sync(() =>
    setResponseHeader("cache-control", "private, no-store")
  );
  const readSession = yield* readSessionMemo(getRequest());
  const session = yield* readSession;
  return yield* readSchoolFrame({
    locale: negotiateLocale(getRequestHeaders()),
    slug: input.slug,
    token: session.convexToken,
  }).pipe(Effect.provide(SchoolReadsLive));
});

/** The handler of the school frame server function, which the tests call directly. */
export const frameHandler = serverHandler(readFrame);
