import { useTranslations } from "use-intl";
import { TableEmpty } from "@/components/shared/table/frame";

/** What Insight shows while the school has recorded no impact assessment. */
export function InsightOff() {
  const t = useTranslations("SchoolInsight");
  return (
    <TableEmpty
      act="waving"
      description={t("off-description")}
      title={t("off")}
    />
  );
}
