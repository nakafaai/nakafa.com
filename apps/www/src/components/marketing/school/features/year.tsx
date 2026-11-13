import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { GraduationCard } from "@/components/marketing/school/features/graduation";
import { ParentCard } from "@/components/marketing/school/features/parents";
import { ReportCard } from "@/components/marketing/school/features/reports";
import {
  FeaturePanel,
  FeatureSwitch,
} from "@/components/marketing/school/features/switch";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";

/**
 * The year part, its words on the end side: the report cards the school signs, the year's end that moves every class
 * up, and what each parent sees, one at a time under a button group.
 */
export function SchoolYear() {
  const t = useTranslations("SchoolSite");

  return (
    <FeatureRow id="year" layout="end">
      <SchoolFeatureText feature="year">
        <Nina act="graduating" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <FeatureSwitch
          features={["reports", "graduation", "parents"]}
          label={t("year-title")}
        >
          <FeaturePanel feature="reports">
            <ReportCard />
          </FeaturePanel>
          <FeaturePanel feature="graduation">
            <GraduationCard />
          </FeaturePanel>
          <FeaturePanel feature="parents">
            <ParentCard />
          </FeaturePanel>
        </FeatureSwitch>
      </FeatureProduct>
    </FeatureRow>
  );
}
