import { UnitCircleCard } from "@repo/design-system/components/contents/mathematics/circle/unit";
import { useTranslations } from "use-intl";
import { useLessonSelection } from "@/components/marketing/about/lesson/selection";

/** The circle lesson's lab: the unit circle, with its angle controls. */
export function CircleLesson() {
  const t = useTranslations("Landing");
  const angle = useLessonSelection((state) => state.circleAngle);
  const onAngleChange = useLessonSelection((state) => state.setCircleAngle);

  return (
    <UnitCircleCard
      angle={angle ?? undefined}
      description={t("lab.circle.description")}
      onAngleChange={onAngleChange}
      title={t("lab.circle.title")}
      viewLabel={t("lab.circle.view")}
    />
  );
}
