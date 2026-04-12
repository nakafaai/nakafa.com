import { redirect } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Page(
  props: PageProps<"/[locale]/school/[slug]/classes/[id]">
) {
  const { params } = props;
  const { id, locale, slug } = await params;

  const validLocale = getLocaleOrThrow(locale);

  redirect(`/${validLocale}/school/${slug}/classes/${id}/forum`);
}
