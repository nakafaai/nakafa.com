import {
  AiChat02Icon,
  BubbleChatIcon,
  Certificate01Icon,
  ChartLineData01Icon,
  ChildIcon,
  FolderLibraryIcon,
  Mortarboard01Icon,
  Quiz01Icon,
  TaskDone01Icon,
} from "@hugeicons/core-free-icons";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { MarketingSection } from "@/components/marketing/shared/section";

/** What a school gets, the classroom first, each with an icon no other feature uses. */
const SCHOOL_FEATURES = [
  { icon: BubbleChatIcon, key: "forum" },
  { icon: FolderLibraryIcon, key: "library" },
  { icon: TaskDone01Icon, key: "tasks" },
  { icon: Quiz01Icon, key: "exams" },
  { icon: Certificate01Icon, key: "reports" },
  { icon: ChartLineData01Icon, key: "insight" },
  { icon: Mortarboard01Icon, key: "graduation" },
  { icon: ChildIcon, key: "parents" },
  { icon: AiChat02Icon, key: "nina" },
] as const;

/** One feature: its icon, its name, and one sentence. */
function SchoolFeature({
  feature,
}: {
  feature: (typeof SCHOOL_FEATURES)[number];
}) {
  const t = useTranslations("SchoolSite");

  return (
    <Card data-school-feature={feature.key}>
      <CardHeader>
        <HugeIcons className="text-primary mb-2 size-6" icon={feature.icon} />
        <CardTitle>
          <h3 className="text-lg font-medium tracking-tight">
            {t(`feature-${feature.key}-title`)}
          </h3>
        </CardTitle>
        <CardDescription className="text-base text-pretty">
          {t(`feature-${feature.key}-text`)}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

/** What the school gets, around the classroom, in a grid of one card per tool. */
export function SchoolFeatures() {
  const t = useTranslations("SchoolSite");

  return (
    <MarketingSection id="features" labelledBy="school-features-title">
      <div className="mx-auto grid w-full max-w-7xl gap-12">
        <div className="mx-auto grid max-w-2xl gap-3 text-center">
          <h2
            className="text-3xl tracking-tight text-balance sm:text-4xl"
            id="school-features-title"
          >
            {t("features-title")}
          </h2>
          <p className="text-muted-foreground text-lg text-pretty">
            {t("features-lead")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Arr.map(SCHOOL_FEATURES, (feature) => (
            <SchoolFeature feature={feature} key={feature.key} />
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}
