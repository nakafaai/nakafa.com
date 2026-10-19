import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect } from "effect";
import { cache } from "react";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** The signed-in viewer's view of one school, as the school's layouts and pages read it. */
export type SchoolMember = Ref.Returns<typeof tenancy.viewer.get>;

/**
 * What one request sees of one school: a visitor without a session, a signed-in
 * account that is not a member, a member whom the school does not admit, or a member
 * with the view of the school.
 */
export type SchoolViewer =
  | { readonly _tag: "denied" }
  | { readonly _tag: "member"; readonly viewer: SchoolMember }
  | { readonly _tag: "outsider" }
  | { readonly _tag: "visitor" };

/**
 * The public profile of the school at an address, or none when no school has it.
 * The school's layout and its metadata both read it, once per request.
 */
export const readProfile = cache((slug: TenantSlug) =>
  Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.profile.get, { slug })),
      Effect.asSome,
      Effect.catchTag("TenantNotFound", () => Effect.succeedNone),
      Effect.provide(httpLayer())
    )
  )
);

/**
 * The viewer's view of one school, read with the session token of the request. The
 * school's layout and every page under it ask for the same answer, and React's `cache`
 * shares it, so one request reads the viewer once. A visitor without a session reads
 * nothing, and a failure other than the two refusals reaches the error boundary.
 */
export const readViewer = cache(
  async (slug: TenantSlug): Promise<SchoolViewer> => {
    const token = await getToken();
    if (token === undefined) {
      return { _tag: "visitor" };
    }
    return Effect.runPromise(
      HttpClient.HttpClient.pipe(
        Effect.flatMap((client) => client.query(tenancy.viewer.get, { slug })),
        Effect.map((viewer): SchoolViewer => ({ _tag: "member", viewer })),
        Effect.catchTags({
          AccessDenied: () => Effect.succeed<SchoolViewer>({ _tag: "denied" }),
          NotMember: () => Effect.succeed<SchoolViewer>({ _tag: "outsider" }),
        }),
        Effect.provide(httpLayer({ auth: token }))
      )
    );
  }
);
