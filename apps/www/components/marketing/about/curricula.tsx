import { ArrowUpRight01Icon, Globe02Icon } from "@hugeicons/core-free-icons";
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

/** Renders a country flag when available and a global curriculum mark otherwise. */
function CurriculumCountryMark({ countryCode }: { countryCode?: string }) {
  return (
    <CountryFlagIcon
      className="h-auto w-6 rounded-xs ring-1 ring-foreground/10"
      countryCode={countryCode}
      fallback={<HugeIcons className="size-5 shrink-0" icon={Globe02Icon} />}
    />
  );
}

/** Lets learners enter Nakafa through the curriculum they already use. */
export async function Curricula({ locale }: { locale: Locale }) {
  const [t, catalog] = await Promise.all([
    getTranslations({ locale, namespace: "CurriculaSection" }),
    readRuntimeCurriculumCatalog(locale),
  ]);
  const curricula = readRuntimeCurriculumOptions(catalog, locale);

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
          className="grid grid-cols-2 gap-px border-t bg-border lg:grid-cols-4"
        >
          {curricula.map((curriculum) => (
            <NavigationLink
              className="group relative flex min-h-40 flex-col items-start justify-between bg-background p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:min-h-44 sm:p-6 lg:min-h-48 lg:p-8"
              href={curriculum.href}
              key={curriculum.programKey}
            >
              <CurriculumCountryMark countryCode={curriculum.countryCode} />
              <span className="max-w-52 text-pretty text-lg tracking-tight sm:text-xl">
                {curriculum.title}
              </span>
            </NavigationLink>
          ))}
        </nav>

        <div className="relative min-h-64 overflow-hidden border-t sm:min-h-72 lg:min-h-80">
          <CurriculaArt maxPixelCount={CURRICULA_SHADER_PIXEL_BUDGET} />
        </div>
      </div>
    </section>
  );
}
