import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutSetPageClient } from "@/components/tryout/set.client";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders one try-out set and its section list. */
export default async function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    set: string;
  }>;
}) {
  const { country, exam, locale: localeParam, set } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const setPath = getTryoutHref({ country, exam, set }).slice(1);

  return (
    <TryoutSetPageClient
      country={country}
      exam={exam}
      locale={locale}
      publicPath={setPath}
    />
  );
}
