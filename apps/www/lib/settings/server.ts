import { redirect } from "@repo/internationalization/src/navigation";
import { notFound } from "next/navigation";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";

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

  return { locale, token };
}
