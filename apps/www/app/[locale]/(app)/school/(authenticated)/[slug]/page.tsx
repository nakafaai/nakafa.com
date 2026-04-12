import { redirect } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Page(
  props: PageProps<"/[locale]/school/[slug]">
) {
  const { params } = props;
  const { locale, slug } = await params;

  const validLocale = getLocaleOrThrow(locale);

  redirect(`/${validLocale}/school/${slug}/home`);
}
