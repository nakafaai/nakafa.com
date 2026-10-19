import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import { cache } from "react";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** The public profile of the school at an address, or none when no school has it. */
const queryProfile = (slug: TenantSlug) =>
  HttpClient.HttpClient.pipe(
    Effect.flatMap((client) => client.query(tenancy.profile.get, { slug })),
    Effect.asSome,
    Effect.catchTag("TenantNotFound", () => Effect.succeedNone),
    Effect.provide(httpLayer())
  );

/**
 * The public profile of the school at an address, or none when no school has it.
 * The school's layout reads it once per request, so its logo and mascot follow
 * each save.
 */
export const readProfile = cache((slug: TenantSlug) =>
  Effect.runPromise(queryProfile(slug))
);

/**
 * The name of a school as plain data. A cached function may return only plain data, and an
 * Effect `Option` is a class instance, so the cache holds this form and the reader decodes it.
 */
const SchoolNameIso = Schema.toCodecIso(Schema.Option(Schema.String));

/**
 * The name of the school at an address in the cache's plain form, which the cache can hold.
 * The `minutes` cache profile's five-minute stale time keeps the metadata off uncached data.
 */
async function readCachedSchoolName(slug: TenantSlug) {
  const profile = await Effect.runPromise(queryProfile(slug));
  return Schema.encodeSync(SchoolNameIso)(
    Option.map(profile, ({ name }) => name)
  );
}

/**
 * The name of the school at an address, or none when no school has it, for the titles of its
 * pages. A school renames rarely, so the name comes from the cached `minutes` profile.
 */
export async function readSchoolName(
  slug: TenantSlug
): Promise<Option.Option<string>> {
  const name = await readCachedSchoolName(slug);
  return Effect.runPromise(Schema.decodeEffect(SchoolNameIso)(name));
}

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
