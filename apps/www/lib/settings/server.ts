import { redirect } from "@repo/internationalization/src/navigation";
import { Effect, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { scheduleCurrentServerExceptionCapture } from "@/lib/analytics/server";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** One authenticated settings preload failed; the owning card degrades. */
export class UserSettingsPreloadError extends Schema.TaggedError<UserSettingsPreloadError>()(
  "UserSettingsPreloadError",
  { cause: Schema.Unknown }
) {}

/**
 * Resolves the active locale for one private settings route and ends the
 * request when the visitor is not signed in.
 *
 * Every settings page streams its authenticated cards behind one `<Suspense>`
 * boundary, so admission belongs inside that boundary instead of in a layout
 * that also serves public routes.
 */
export async function admitUserSettingsRoute(rawLocale: string) {
  const locale = getLocaleOrThrow(rawLocale);

  if (!isActiveLocale(locale)) {
    notFound();
  }

  const token = await getToken();

  if (!token) {
    redirect({ href: "/auth", locale });
  }

  return locale;
}

/** Defers one authenticated settings query read into a settings failure. */
export function preloadUserSettingsQuery<A>(load: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) => new UserSettingsPreloadError({ cause }),
    try: load,
  });
}

/**
 * Resolves one settings preload, reporting an unexpected failure without
 * failing the route or the sibling settings cards.
 */
export function captureUserSettingsPreload<A>(
  program: Effect.Effect<A, UserSettingsPreloadError>
) {
  return program.pipe(
    Effect.asSome,
    Effect.catchTag("UserSettingsPreloadError", (error) =>
      scheduleCurrentServerExceptionCapture(error.cause, {
        source: "user-settings-preload",
      }).pipe(Effect.as(Option.none()))
    )
  );
}
