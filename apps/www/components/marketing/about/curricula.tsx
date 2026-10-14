import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CurriculumList } from "@/components/marketing/about/curricula/list.client";
import {
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
} from "@/lib/curriculum/model";

/**
 * The curricula part: a heading and the curricula of the catalog, which the
 * list lights up one at a time. The names come from the catalog, so the page
 * never names a class.
 */
export async function Curricula({ locale }: { locale: Locale }) {
  const [t, catalog] = await Promise.all([
    getTranslations({ locale, namespace: "Landing" }),
    readRuntimeCurriculumCatalog(locale),
  ]);
  const curricula = readRuntimeCurriculumOptions(catalog, locale);

  return (
    <section
      className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32"
      id="curricula"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10">
        <h2 className="max-w-4xl text-balance text-3xl tracking-tight sm:text-4xl">
          {t("curricula-title")}
        </h2>
        <CurriculumList curricula={curricula} label={t("curricula-list")} />
      </div>
    </section>
  );
}
