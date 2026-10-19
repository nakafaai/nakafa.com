import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect } from "effect";
import { io } from "next/cache";
import { cache } from "react";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/**
 * The public profile of the school at an address, or none when no school has it.
 * The school's layout and its metadata both read it, once per request.
 */
export const readProfile = cache(async (slug: TenantSlug) => {
  // `io()` tells Next.js that request-time work follows, so a prerender stops here
  // and the Effect runtime, which reads the clock when it starts, never runs in one.
  await io();
  return Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.profile.get, { slug })),
      Effect.asSome,
      Effect.catchTag("TenantNotFound", () => Effect.succeedNone),
      Effect.provide(httpLayer())
    )
  );
});

/**
 * The viewer's view of one school, read with the session token of the request. The
 * school's layout and every page under it ask for the same answer, and React's `cache`
 * shares it, so one request reads the viewer once. A visitor without a session reads
 * nothing, and a failure other than the two refusals reaches the error boundary. An
 * outsider keeps the token it was read with, so the layout reads the account with it.
 */
export const readViewer = cache(async (slug: TenantSlug) => {
  const token = await getToken();
  if (token === undefined) {
    return { _tag: "visitor" as const };
  }
  return Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.viewer.get, { slug })),
      Effect.map((viewer) => ({ _tag: "member" as const, viewer })),
      Effect.catchTags({
        AccessDenied: () => Effect.succeed({ _tag: "denied" as const }),
        NotMember: () => Effect.succeed({ _tag: "outsider" as const, token }),
      }),
      Effect.provide(httpLayer({ auth: token }))
    )
  );
});
