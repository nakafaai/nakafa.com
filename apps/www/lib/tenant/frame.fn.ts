import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { createServerFn } from "@tanstack/react-start";
import {
  getRequest,
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";
import { readSessionMemo } from "@/lib/auth/session.server";
import { serverHandler } from "@/lib/server/fn";
import { readSchoolFrame, SchoolReadsLive } from "@/lib/tenant/read";

/** The school whose frame the browser asks for. */
const SchoolFrameInput = Schema.Struct({ slug: TenantSlug });

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

/** The school frame server function, which returns no credential. */
export const readSchoolFrameFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SchoolFrameInput))
  .handler(frameHandler);
