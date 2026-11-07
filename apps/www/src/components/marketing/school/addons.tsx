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
import { useLocale, useTranslations } from "use-intl";
import { SchoolAmount } from "@/components/marketing/school/price";
import { formatStorage } from "@/lib/pricing/school";

/** The icon of each add-on, none shared. */
const ADD_ON_ICONS = {
  credits: SparklesIcon,
  drive: CloudServerIcon,
  driveLarge: HardDriveIcon,
} as const satisfies Record<SchoolAddOnKey, typeof SparklesIcon>;

/** One add-on: its icon and name, its price once or a month, and what it gives. */
function SchoolAddOn({ addOn }: { addOn: SchoolAddOnKey }) {
  const t = useTranslations("SchoolSite");
  const locale = useLocale();
  const item = schoolAddOns[addOn];

  return (
    <Card data-school-addon={addOn}>
      <CardHeader>
        <HugeIcons
          className="text-primary mb-2 size-6"
          icon={ADD_ON_ICONS[addOn]}
        />
        <h3 className="text-lg font-medium tracking-tight">
          {item.recurring
            ? t("addon-drive-title", {
                size: formatStorage(item.storageMegabytes, locale),
              })
            : t("addon-credits-title", { count: item.credits })}
        </h3>
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 whitespace-nowrap">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            <SchoolAmount amounts={item.price} />
          </span>
          <span className="text-muted-foreground">
            {item.recurring ? t("plan-month") : t("addon-once")}
          </span>
        </p>
        <p className="text-muted-foreground text-pretty">
          {item.recurring
            ? t("addon-drive-text")
            : t("addon-credits-text", { months: SCHOOL_CREDIT_PACK_MONTHS })}
        </p>
      </CardContent>
    </Card>
  );
}

/** The add-ons beside a plan: AI credits once, and Drive storage a month. */
export function SchoolAddOns() {
  const t = useTranslations("SchoolSite");

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="text-2xl tracking-tight text-balance">
          {t("addons-title")}
        </h2>
        <p className="text-muted-foreground text-pretty">{t("addons-lead")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SchoolAddOn addOn="credits" />
        <SchoolAddOn addOn="drive" />
        <SchoolAddOn addOn="driveLarge" />
      </div>
    </div>
  );
}
