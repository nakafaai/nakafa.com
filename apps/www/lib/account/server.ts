import { redirect } from "@repo/internationalization/src/navigation";
import { notFound } from "@tanstack/react-router";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Resolves the active locale for one private account route and ends the
 * request when the visitor is not signed in.
 *
 * Every account page streams its authenticated content behind one `<Suspense>`
 * boundary, so admission belongs inside that boundary instead of in a layout
 * that also serves public routes.
 */
export async function admitAccountRoute(rawLocale: string) {
  const locale = getLocaleOrThrow(rawLocale);

  if (!isActiveLocale(locale)) {
    throw notFound();
  }

  const token = await getToken();

  if (!token) {
    redirect({ href: "/auth", locale });
  }

  return { locale, token };
}
