import { routing } from "@repo/internationalization/src/routing";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

export default async function Page(
  props: PageProps<"/[locale]/school/[slug]">
) {
  const { params } = props;
  const { locale, slug } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  redirect(`/${locale}/school/${slug}/home`);
}
