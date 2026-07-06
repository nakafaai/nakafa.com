import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutSectionPageClient } from "@/components/tryout/section.client";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders the public question payload for one try-out section. */
export default async function Page(props: {
  params: Promise<{
    country: string;
    exam: string;
    locale: string;
    section: string;
    set: string;
  }>;
}) {
  const {
    country,
    exam,
    locale: localeParam,
    section,
    set,
  } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const sectionPath = getTryoutHref({ country, exam, section, set }).slice(1);

  return (
    <TryoutSectionPageClient
      country={country}
      exam={exam}
      locale={locale}
      publicPath={sectionPath}
      section={section}
      set={set}
    />
  );
}
