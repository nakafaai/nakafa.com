import { Nina } from "@repo/design-system/components/ui/nina";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { MarketingSection } from "@/components/marketing/shared/section";
import { Link } from "@/lib/routing/link";

/** The last screen of the School landing: Nina waving, one sentence, and the free trial. */
export function SchoolClosing() {
  const t = useTranslations("SchoolSite");

  return (
    <MarketingSection id="start" labelledBy="school-closing-title">
      <div className="mx-auto grid w-full max-w-2xl justify-items-center gap-6 text-center">
        <Nina act="waving" label="" size={120} />
        <h2
          className="text-3xl tracking-tight text-balance sm:text-4xl"
          id="school-closing-title"
        >
          {t("closing-title")}
        </h2>
        <p className="text-muted-foreground text-lg text-pretty">
          {t("closing-lead")}
        </p>
        <Link
          className={buttonVariants({ size: "lg" })}
          to="/$locale/school/new"
        >
          {t("hero-start")}
        </Link>
      </div>
    </MarketingSection>
  );
}
