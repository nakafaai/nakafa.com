import { routing } from "@repo/internationalization/src/routing";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";

export default async function Page(
  props: PageProps<"/[locale]/school/[slug]/classes/[id]">
) {
  const { params } = props;
  const { id, locale, slug } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  redirect(`/${locale}/school/${slug}/classes/${id}/forum`);
}
