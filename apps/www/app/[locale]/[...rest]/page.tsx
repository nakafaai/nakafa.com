import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

export default async function Page(props: PageProps<"/[locale]/[...rest]">) {
  const { params } = props;
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  notFound();
}
