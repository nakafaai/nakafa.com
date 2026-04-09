import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { EventAccessPage } from "@/components/event/access-page";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Page(
  props: PageProps<"/[locale]/event/try-out/[code]">
) {
  const { params } = props;
  const { code, locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  // Enable static rendering
  setRequestLocale(locale);

  return <EventAccessPage code={code} />;
}
