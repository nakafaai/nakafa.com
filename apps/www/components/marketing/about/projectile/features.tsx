"use client";

import { useIntersection } from "@mantine/hooks";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  DEFAULT_PROJECTILE_SCENARIO_ID,
  formatMeterMath,
  formatSecondMath,
  formatSpeedMath,
  formatVelocityVectorMath,
  getProjectileMotionState,
  getVelocityAtTime,
  isProjectileScenarioId,
  PROJECTILE_INSTANT_TIME,
  PROJECTILE_SCENARIOS,
  type ProjectileScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Effect, Fiber } from "effect";
import { useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
  type ComponentType,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { loadProjectileScene } from "@/components/marketing/about/projectile/loader";
import type { ProjectileSceneProps } from "@/components/marketing/about/projectile/scene";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Imports the scene module after viewport intent.
 *
 * @see https://nextjs.org/docs/app/guides/lazy-loading
 */
const importProjectileScene = () =>
  import("@/components/marketing/about/projectile/scene").then(
    (module) => module.ProjectileScene
  );

const decimalSeparators = {
  de: "comma",
  en: "dot",
  id: "comma",
} as const satisfies Record<ActiveAppLocaleCode, "comma" | "dot">;

/** Keeps the lesson content available while deferring only its WebGL scene. */
export function FeaturesProjectile() {
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin: "400px 0px",
    threshold: 0.01,
  });
  const t = useTranslations("Features");
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const sceneLoadFiber = useRef<ReturnType<typeof Effect.runFork> | null>(null);
  const [Scene, setScene] =
    useState<ComponentType<ProjectileSceneProps> | null>(null);
  const [scenarioId, setScenarioId] = useState<ProjectileScenarioId>(
    DEFAULT_PROJECTILE_SCENARIO_ID
  );
  const motion = getProjectileMotionState(scenarioId);
  const decimalSeparator = decimalSeparators[locale];
  const instantVelocity = getVelocityAtTime(motion, PROJECTILE_INSTANT_TIME);
  const facts = [
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
          math={`T=${formatSecondMath(motion.flightTime, decimalSeparator)}`}
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
  ];

  /** Selects a verified projectile scenario for the interactive lesson scene. */
  function handleScenarioChange(value: string) {
    if (!isProjectileScenarioId(value)) {
      return;
    }

    setScenarioId(value);
  }

  /** Starts the WebGL import only when the lesson approaches the viewport. */
  const handleSceneIntent = useEffectEvent(() => {
    if (Scene || sceneLoadFiber.current) {
      return;
    }

    sceneLoadFiber.current = Effect.runFork(
      loadProjectileScene(importProjectileScene).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.sync(() => {
              sceneLoadFiber.current = null;
            }).pipe(
              Effect.andThen(
                reportClientException(error, {
                  operation: "load-projectile-scene",
                  source: "home-features",
                })
              )
            ),
          onSuccess: (SceneComponent) =>
            Effect.sync(() => setScene(() => SceneComponent)),
        })
      )
    );
  });

  useEffect(() => {
    if (!entry?.isIntersecting) {
      return;
    }

    handleSceneIntent();
  }, [entry]);

  /**
   * Interrupts the scene loader before Next Activity hides the route.
   *
   * @see https://nextjs.org/docs/app/guides/preserving-ui-state#effect-and-media-cleanup
   */
  useLayoutEffect(
    () => () => {
      const currentSceneLoad = sceneLoadFiber.current;
      sceneLoadFiber.current = null;

      if (!currentSceneLoad) {
        return;
      }

      Effect.runFork(Fiber.interrupt(currentSceneLoad));
    },
    []
  );

  return (
    <div
      className="relative flex min-h-[42rem] flex-col overflow-hidden bg-background lg:col-span-7 lg:min-h-[44rem]"
      ref={ref}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-8 p-8 lg:p-10">
        <h3 className="max-w-2xl text-balance text-3xl tracking-tight sm:text-4xl">
          {t.rich("projectile-title", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h3>

        <div className="mt-auto flex flex-col gap-4">
          <ToggleGroup
            aria-label={t("projectile-controls")}
            gridColumns="3"
            onValueChange={handleScenarioChange}
            type="single"
            value={scenarioId}
            variant="outline"
          >
            {PROJECTILE_SCENARIOS.map((scenario) => (
              <ToggleGroupItem key={scenario.id} value={scenario.id}>
                {t(`projectile-${scenario.id}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <section
            aria-label={t("projectile-view-label")}
            className={threeSceneFrameVariants()}
          >
            {entry?.isIntersecting && Scene ? (
              <Scene motion={motion} shouldReduceMotion={shouldReduceMotion} />
            ) : null}
          </section>
        </div>
      </div>

      <div className="border-t p-8 lg:p-10">
        <dl className="grid w-full grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {facts.map((fact) => (
            <div className="flex min-w-0 flex-col gap-1" key={fact.id}>
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="wrap-break-word text-foreground tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
