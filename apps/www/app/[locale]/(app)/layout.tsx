import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

/**
 * Binds the validated locale to the full authenticated app subtree.
 *
 * Keeping this locale setup at the shared `(app)` segment lets nested route
 * groups focus on shell and provider ownership instead of repeating the same
 * request setup in every child layout.
 */
export default async function Layout(props: LayoutProps<"/[locale]">) {
  const { children, params } = props;
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return children;
}
