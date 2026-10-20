import { ParabolicMovementLab } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab";
import { useTranslations } from "use-intl";
import { getProjectileLabels } from "@/components/marketing/about/lesson/labels";
import type { LessonLabProps } from "@/components/marketing/about/lesson/labs";
import { useLessonSelection } from "@/components/marketing/about/lesson/selection";

/**
 * The projectile lesson's lab: a ball thrown at a chosen angle, in three
 * dimensions. It gets interface labels only; its numbers come from its own data.
 */
export function ProjectileLesson({ decimalSeparator }: LessonLabProps) {
  const t = useTranslations("Landing");
  const defaultLaunchId = useLessonSelection((state) => state.projectileLaunch);
  const onLaunchIdChange = useLessonSelection(
    (state) => state.setProjectileLaunch
  );

  return (
    <ParabolicMovementLab
      decimalSeparator={decimalSeparator}
      defaultLaunchId={defaultLaunchId ?? undefined}
      labels={getProjectileLabels(t)}
      onLaunchIdChange={onLaunchIdChange}
    />
  );
}
