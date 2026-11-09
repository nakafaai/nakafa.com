import {
  CloudServerIcon,
  HardDriveIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import {
  SCHOOL_CREDIT_PACK_MONTHS,
  type SchoolAddOnKey,
  schoolAddOns,
} from "@repo/backend/confect/billing/tiers";
import {
  Card,
  CardContent,
  CardHeader,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { formatBytes } from "@repo/internationalization/src/formats";
import { useLocale, useTranslations } from "use-intl";
import { SchoolAmount } from "@/components/marketing/school/pricing/price";
import { MarketingSection } from "@/components/marketing/shared/section";

/** The icon of each add-on, none shared. */
const ADD_ON_ICONS = {
  credits: SparklesIcon,
  drive: CloudServerIcon,
  driveLarge: HardDriveIcon,
} as const satisfies Record<SchoolAddOnKey, typeof SparklesIcon>;

/**
 * One add-on: its icon and name, its price once or a month, and what it gives, on the three rows its
 * siblings share from `md`, so every name, price and sentence starts on one line across the cards.
 */
function SchoolAddOn({ addOn }: { addOn: SchoolAddOnKey }) {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const item = schoolAddOns[addOn];

  return (
    <Card
      className="md:row-span-3 md:grid md:grid-rows-subgrid md:gap-y-2"
      data-school-addon={addOn}
    >
      <CardHeader className="md:mb-4">
        <h3 className="flex items-center gap-2 text-lg font-medium tracking-tight">
          <HugeIcons
            className="text-muted-foreground size-4"
            icon={ADD_ON_ICONS[addOn]}
          />
          {item.recurring
            ? t("addon-drive-title", {
                size: formatBytes(item.storageMegabytes * 1_000_000, locale),
              })
            : t("addon-credits-title", { count: item.credits })}
        </h3>
      </CardHeader>
      <CardContent className="md:contents">
        <p className="flex flex-wrap items-baseline gap-x-2 whitespace-nowrap md:px-(--card-spacing)">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            <SchoolAmount amounts={item.price} />
          </span>
          <span className="text-muted-foreground">
            {item.recurring ? t("plan-month") : t("addon-once")}
          </span>
        </p>
        <p className="text-muted-foreground mt-2 text-pretty md:mt-0 md:px-(--card-spacing)">
          {item.recurring
            ? t("addon-drive-text")
            : t("addon-credits-text", { months: SCHOOL_CREDIT_PACK_MONTHS })}
        </p>
      </CardContent>
    </Card>
  );
}

/** The add-ons beside a plan, on a screen of their own: AI credits once, and Drive storage a month. */
export function SchoolAddOns() {
  const t = useTranslations("SchoolSite");

  return (
    <MarketingSection id="addons" labelledBy="school-addons-title">
      <div className="mx-auto grid w-full max-w-7xl gap-12">
        <div className="mx-auto grid max-w-2xl gap-3 text-center">
          <h2
            className="text-3xl tracking-tight text-balance sm:text-4xl"
            id="school-addons-title"
          >
            {t("addons-title")}
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">
            {t("addons-lead")}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:grid-rows-[repeat(3,auto)]">
          <SchoolAddOn addOn="credits" />
          <SchoolAddOn addOn="drive" />
          <SchoolAddOn addOn="driveLarge" />
        </div>
      </div>
    </MarketingSection>
  );
}
