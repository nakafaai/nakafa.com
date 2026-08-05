import type { api } from "@repo/backend/convex/_generated/api";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import type { FunctionReturnType } from "convex/server";
import { useLocale, useTranslations } from "next-intl";
import { ChoiceCardContent } from "@/components/shared/choice/card";
import { choiceCardVariants } from "@/components/shared/choice/variants";
import { ChoiceCardVisual } from "@/components/shared/choice/visual";
import { CountryFlagIcon } from "@/components/shared/country-flag";

type TryoutCountry = FunctionReturnType<
  typeof api.tryouts.queries.catalog.getHubPage
>["countries"][number];

/** Shows the signed production try-out catalog inside the marketing story. */
export function FeaturesTryout({
  countries,
}: {
  readonly countries: readonly TryoutCountry[];
}) {
  const locale = useLocale();
  const t = useTranslations("Features");

  return (
    <div className="relative flex min-h-[38rem] flex-col overflow-hidden border-b bg-background lg:col-span-5 lg:min-h-[40rem]">
      <h3 className="text-balance p-8 text-3xl tracking-tight sm:text-4xl lg:p-10">
        {t.rich("tryout-title", {
          mark: (chunks) => <mark>{chunks}</mark>,
        })}
      </h3>
      <article className="mt-auto px-8 pt-10 pb-8 lg:px-10 lg:pt-12 lg:pb-10">
        <div className="grid grid-cols-2 gap-3">
          {countries.slice(0, 4).map((country) => (
            <IntentLink
              className={choiceCardVariants()}
              href={`/${locale}/${country.publicPath}`}
              key={country.countryKey}
            >
              <ChoiceCardVisual seed={country.publicPath}>
                <CountryFlagIcon
                  className="relative h-6 w-9 rounded-[2px] ring-1 ring-border/60"
                  countryCode={country.countryCode}
                />
              </ChoiceCardVisual>
              <ChoiceCardContent>
                <h4>{country.title}</h4>
              </ChoiceCardContent>
            </IntentLink>
          ))}
        </div>
      </article>
    </div>
  );
}
