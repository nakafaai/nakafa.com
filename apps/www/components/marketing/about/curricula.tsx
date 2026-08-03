import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import {
  readRuntimeCurriculumCatalog,
  readRuntimeCurriculumOptions,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/runtime";
import { CurriculaArt } from "@/components/marketing/about/curricula-art";
import { CountryFlagIcon } from "@/components/shared/country-flag";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";

const CURRICULA_SHADER_PIXEL_BUDGET = 720_000;

/** Lets learners enter Nakafa through the curriculum they already use. */
export async function Curricula({ locale }: { locale: Locale }) {
  const [t, catalog] = await Promise.all([
    getTranslations({ locale, namespace: "CurriculaSection" }),
    readRuntimeCurriculumCatalog(locale),
  ]);
  const curricula = readRuntimeCurriculumOptions(catalog, locale);
  const cardPixelBudget = Math.floor(
    CURRICULA_SHADER_PIXEL_BUDGET / Math.max(curricula.length, 1)
  );

  return (
    <section
      className="relative isolate z-0 border-b bg-background"
      id="curricula"
    >
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="px-6 py-24 sm:py-28 lg:px-10 lg:py-32">
          <h2 className="max-w-4xl text-pretty text-3xl tracking-tight sm:text-4xl">
            {t.rich("headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>
          <p className="mt-6 max-w-2xl text-pretty text-foreground/70 text-lg">
            {t("description")}
          </p>
          <Button
            className="mt-8"
            nativeButton={false}
            render={
              <NavigationLink href={getCurriculumIndexHref(locale)}>
                {t("cta")}
                <HugeIcons icon={ArrowUpRight01Icon} />
              </NavigationLink>
            }
          />
        </div>

        <nav
          aria-label={t("navigation")}
          className="grid grid-cols-2 border-t lg:grid-cols-4"
        >
          {curricula.map((curriculum) => (
            <NavigationLink
              className="group relative min-h-64 overflow-hidden border-r border-b p-5 outline-none even:border-r-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:min-h-72 sm:p-6 lg:min-h-80 lg:border-r lg:p-8 lg:last:border-r-0"
              href={curriculum.href}
              key={curriculum.programKey}
            >
              <CurriculaArt
                maxPixelCount={cardPixelBudget}
                programKey={curriculum.programKey}
              />
              <span className="relative z-1 flex flex-col items-start gap-4">
                <CountryFlagIcon
                  className="h-auto w-6 rounded-xs ring-1 ring-foreground/10"
                  countryCode={curriculum.countryCode}
                />
                <span className="max-w-52 text-pretty text-lg tracking-tight sm:text-xl">
                  {curriculum.title}
                </span>
              </span>
            </NavigationLink>
          ))}
        </nav>
      </div>
    </section>
  );
}
