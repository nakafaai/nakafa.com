import "@tanstack/react-start/server-only";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { readRequestToken } from "@/lib/auth/session.server";
import { serverHandler } from "@/lib/server/fn";
import type { ServerServices } from "@/lib/server/runtime";
import { SchoolReadFailed } from "@/lib/tenant/read";

/**
 * The Convex token of a school member's request. A member's page reads its first
 * screen with it. A request without a token fails the read, so the school's own
 * boundary shows the failure instead of an empty page.
 */
export const readMemberToken = Effect.fn("www.tenant.memberToken")(
  function* () {
    const token = yield* readRequestToken(getRequest());
    if (token === undefined) {
      return yield* new SchoolReadFailed({
        cause: "The school read has no session token.",
      });
    }
    return token;
  }
);

/**
 * Runs a school member's server function with the request's token. The answer is
 * private before the effect runs, so no cache keeps one member's data.
 */
export function memberHandler<Data, A, E>(
  run: (data: Data, token: string) => Effect.Effect<A, E, ServerServices>
) {
  return serverHandler((data: Data) =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        setResponseHeader("cache-control", "private, no-store")
      );
      const token = yield* readMemberToken();
      return yield* run(data, token);
    })
  );
}
