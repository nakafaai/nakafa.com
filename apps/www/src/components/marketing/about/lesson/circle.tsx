import { UnitCircleCard } from "@repo/design-system/components/contents/mathematics/unit-circle";
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
      onAngleChange={onAngleChange}
      viewLabel={t("lab.circle.view")}
    />
  );
}
