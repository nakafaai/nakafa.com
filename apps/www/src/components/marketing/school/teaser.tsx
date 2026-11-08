import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { SchoolPlans } from "@/components/marketing/school/plans";
import { SchoolPeriodProvider } from "@/components/marketing/school/switch";
import { MarketingSection } from "@/components/marketing/shared/section";
import { Link } from "@/lib/routing/link";

/** The pricing teaser of the School landing: the three plans at their monthly price, and the way to compare them. */
export function SchoolTeaser() {
  const t = useTranslations("SchoolSite");

  return (
    <MarketingSection id="pricing" labelledBy="school-teaser-title">
      <div className="mx-auto grid w-full max-w-7xl gap-12">
        <div className="mx-auto grid max-w-2xl gap-3 text-center">
          <h2
            className="text-3xl tracking-tight text-balance sm:text-4xl"
            id="school-teaser-title"
          >
            {t("teaser-title")}
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">
            {t("teaser-lead")}
          </p>
        </div>
        <SchoolPeriodProvider>
          <SchoolPlans />
        </SchoolPeriodProvider>
        <div className="grid justify-items-center gap-3 text-center">
          <Link
            className={buttonVariants({ variant: "outline" })}
            to="/$locale/school/pricing"
          >
            {t("teaser-link")}
          </Link>
          <p className="text-muted-foreground text-sm text-pretty">
            {t("tax-note")}
          </p>
        </div>
      </div>
    </MarketingSection>
  );
}
