import {
  formatTrimmedMeterMath,
  formatTrimmedSecondMath,
  formatTrimmedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import {
  formatVelocityVectorMath,
  getProjectileMotionState,
  getVelocityAtTime,
  PROJECTILE_INSTANT_TIME,
  PROJECTILE_SCENARIOS,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Array as Arr } from "effect";
import { getLocale, getTranslations } from "next-intl/server";
import { ProjectileClient } from "@/components/marketing/about/projectile/client";
import { MarketingSection } from "@/components/marketing/shared/section";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { decimalSeparators } from "@/lib/marketing/decimal";

/**
 * The full-width lesson scene. The server works out every formula the scene
 * shows, so the numbers on the water are the lesson's own, and the client only
 * moves the scene and the trajectories.
 */
export async function ProjectileStage() {
  const locale = getLocaleOrThrow(await getLocale());
  const [t, tHome] = await Promise.all([
    getTranslations({ locale, namespace: "Features" }),
    getTranslations({ locale, namespace: "Landing" }),
  ]);
  const decimalSeparator = decimalSeparators[locale];
  const scenarios = Arr.map(PROJECTILE_SCENARIOS, (scenario) => {
    const motion = getProjectileMotionState(scenario.id);
    const instantVelocity = getVelocityAtTime(motion, PROJECTILE_INSTANT_TIME);

    return {
      facts: [
        {
          id: "horizontal-component",
          label: t("projectile-horizontal-component"),
          value: (
            <InlineMath
              math={`v_{0x}=${formatTrimmedSpeedMath(
                motion.horizontalVelocity,
                decimalSeparator
              )}`}
            />
          ),
        },
        {
          id: "vertical-component",
          label: t("projectile-vertical-component"),
          value: (
            <InlineMath
              math={`v_{0y}=${formatTrimmedSpeedMath(
                motion.verticalVelocity,
                decimalSeparator
              )}`}
            />
          ),
        },
        {
          id: "peak-time",
          label: t("projectile-peak-time"),
          value: (
            <InlineMath
              math={`t=${formatTrimmedSecondMath(motion.peakTime, decimalSeparator)}`}
            />
          ),
        },
        {
          id: "flight-time",
          label: t("projectile-flight-time"),
          value: (
            <InlineMath
              math={`T=${formatTrimmedSecondMath(
                motion.flightTime,
                decimalSeparator
              )}`}
            />
          ),
        },
        {
          id: "range",
          label: t("projectile-range"),
          value: (
            <InlineMath
              math={`R=${formatTrimmedMeterMath(motion.range, decimalSeparator)}`}
            />
          ),
        },
        {
          id: "instantaneous-velocity",
          label: t("projectile-instantaneous-velocity"),
          value: (
            <InlineMath
              math={`\\vec{v}=${formatVelocityVectorMath(
                instantVelocity.horizontalVelocity,
                instantVelocity.verticalVelocity,
                decimalSeparator
              )}`}
            />
          ),
        },
      ],
      id: scenario.id,
      label: t(`projectile-${scenario.id}`),
      motion,
    };
  });
  return (
    <MarketingSection id="scene">
      <div className="mx-auto w-full max-w-6xl">
        <ProjectileClient
          chooseLabel={tHome("scene-choose")}
          lead={tHome("scene-lead")}
          scenarios={scenarios}
          title={tHome("scene-title")}
          viewLabel={tHome("scene-label")}
        />
      </div>
    </MarketingSection>
  );
}
