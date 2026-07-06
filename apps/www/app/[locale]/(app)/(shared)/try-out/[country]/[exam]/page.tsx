import { getTranslations } from "next-intl/server";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { TryoutHeader } from "@/components/tryout/chrome";
import { TryoutExamPageClient } from "@/components/tryout/exam.client";
import { getTryoutHref } from "@/components/tryout/routes";
import { readStaticTryoutRoute } from "@/components/tryout/static";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders active try-out sets for one country and exam family. */
export default async function Page(props: {
  params: Promise<{ country: string; exam: string; locale: string }>;
}) {
  const { country, exam, locale: localeParam } = await props.params;
  const locale = getLocaleOrThrow(localeParam);
  const examPath = getTryoutHref({ country, exam }).slice(1);
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const route = readStaticTryoutRoute({
    kind: "tryout-exam",
    locale,
    publicPath: examPath,
  });

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <TryoutHeader
          homeLabel={tCommon("home")}
          items={[
            {
              href: getTryoutHref({ country }),
              label: tCommon("try-out"),
            },
            { label: route?.title ?? exam },
          ]}
          title={route?.title ?? tCommon("try-out")}
        />
        <TryoutExamPageClient locale={locale} publicPath={examPath} />
      </LayoutMaterialContent>
    </LayoutMaterial>
  );
}
