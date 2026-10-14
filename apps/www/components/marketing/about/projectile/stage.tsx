import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  formatTrimmedMeterMath,
  formatTrimmedSecondMath,
  formatTrimmedSpeedMath,
} from "@repo/design-system/components/contents/physics/kinematics/math";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import {
  DEFAULT_PROJECTILE_SCENARIO_ID,
  formatVelocityVectorMath,
  getProjectileMotionState,
  getVelocityAtTime,
  PROJECTILE_INSTANT_TIME,
  PROJECTILE_SCENARIOS,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import { Array as Arr, Option } from "effect";
import { getLocale, getTranslations } from "next-intl/server";
import { NinaPrompt } from "@/components/ai/message/prompt";
import { ProjectileClient } from "@/components/marketing/about/projectile/client";
import { getLocaleOrThrow } from "@/lib/i18n/params";

const decimalSeparators = {
  de: "comma",
  en: "dot",
  id: "comma",
} as const satisfies Record<ActiveAppLocaleCode, DecimalSeparator>;

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
  const initialScenario = Option.orElse(
    Arr.findFirst(scenarios, ({ id }) => id === DEFAULT_PROJECTILE_SCENARIO_ID),
    () => Arr.head(scenarios)
  );

  if (Option.isNone(initialScenario)) {
    return null;
  }

  return (
    <ProjectileClient
      initialScenario={initialScenario.value}
      lead={tHome("scene-lead")}
      scenarios={scenarios}
      talk={
        <>
          <Message align="end">
            <NinaPrompt text={tHome("scene-ask")} />
          </Message>
          <Message>
            <MessageContent>
              <MarkdownContent id="home-scene-answer" variant="chat">
                {tHome("scene-answer")}
              </MarkdownContent>
            </MessageContent>
          </Message>
        </>
      }
      title={tHome("scene-title")}
      viewLabel={tHome("scene-label")}
    />
  );
}
