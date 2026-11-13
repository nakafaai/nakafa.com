import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { InsightTable } from "@/components/marketing/school/features/insight";
import { LibraryTable } from "@/components/marketing/school/features/library";
import {
  FeaturePanel,
  FeatureSwitch,
} from "@/components/marketing/school/features/switch";
import { TaskTable } from "@/components/marketing/school/features/tasks";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";

/**
 * The class part, as wide as the page under its words: a class's drive, its tasks and its students' mastery, each in
 * the School's own table, one at a time under a button group, as a teacher moves between them in a class.
 */
export function SchoolClass() {
  const t = useTranslations("SchoolSite");

  return (
    <FeatureRow id="class" layout="wide">
      <SchoolFeatureText feature="class">
        <Nina act="carrying" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <FeatureSwitch
          features={["library", "tasks", "insight"]}
          label={t("class-title")}
        >
          <FeaturePanel feature="library">
            <LibraryTable />
          </FeaturePanel>
          <FeaturePanel feature="tasks">
            <TaskTable />
          </FeaturePanel>
          <FeaturePanel feature="insight">
            <InsightTable />
          </FeaturePanel>
        </FeatureSwitch>
      </FeatureProduct>
    </FeatureRow>
  );
}
