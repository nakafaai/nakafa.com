import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  DEFAULT_PROJECTILE_SCENARIO_ID,
  formatMeterMath,
  formatSecondMath,
  formatSpeedMath,
  formatVelocityVectorMath,
  getProjectileMotionState,
  getVelocityAtTime,
  PROJECTILE_INSTANT_TIME,
  PROJECTILE_SCENARIOS,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ProjectileClient } from "@/components/marketing/about/projectile/client";

const decimalSeparators = {
  de: "comma",
  en: "dot",
  id: "comma",
} as const satisfies Record<ActiveAppLocaleCode, "comma" | "dot">;

/** Renders deterministic projectile formulas on the server for every scenario. */
export async function FeaturesProjectile({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Features" });
  const decimalSeparator = decimalSeparators[locale];
  const scenarios = PROJECTILE_SCENARIOS.map((scenario) => {
    const motion = getProjectileMotionState(scenario.id);
    const instantVelocity = getVelocityAtTime(motion, PROJECTILE_INSTANT_TIME);

    return {
      facts: [
        {
          id: "horizontal-component",
          label: t("projectile-horizontal-component"),
          value: (
            <InlineMath
              math={`v_{0x}=${formatSpeedMath(
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
              math={`v_{0y}=${formatSpeedMath(
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
              math={`t=${formatSecondMath(motion.peakTime, decimalSeparator)}`}
            />
          ),
        },
        {
          id: "flight-time",
          label: t("projectile-flight-time"),
          value: (
            <InlineMath
              math={`T=${formatSecondMath(
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
              math={`R=${formatMeterMath(motion.range, decimalSeparator)}`}
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
  const initialScenario =
    scenarios.find(({ id }) => id === DEFAULT_PROJECTILE_SCENARIO_ID) ??
    scenarios[0];

  if (!initialScenario) {
    return null;
  }

  return (
    <ProjectileClient
      controlsLabel={t("projectile-controls")}
      initialScenario={initialScenario}
      scenarios={scenarios}
      title={t.rich("projectile-title", {
        mark: (chunks) => <mark>{chunks}</mark>,
      })}
      viewLabel={t("projectile-view-label")}
    />
  );
}
