"use client";

import { useIntersection } from "@mantine/hooks";
import type {
  ProjectileMotionState,
  ProjectileScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Effect } from "effect";
import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { loadProjectileScene } from "@/components/marketing/about/projectile/loader";
import type { ProjectileSceneProps } from "@/components/marketing/about/projectile/scene";
import { reportClientException } from "@/lib/analytics/client";

const reloadProjectilePage = Effect.fn("www.home.reloadProjectilePage")(() =>
  Effect.sync(() => window.location.reload())
);

/** Shows a truthful recovery action after a reported terminal load failure. */
function UnavailableProjectileScene(_props: ProjectileSceneProps) {
  const t = useTranslations("Error");

  return (
    <div
      className="flex size-full flex-col items-center justify-center gap-4 p-4 text-center"
      role="alert"
    >
      <p className="font-medium">{t("title")}</p>
      <Button
        onClick={() => Effect.runSync(reloadProjectilePage())}
        size="sm"
        variant="secondary"
      >
        {t("retry")}
      </Button>
    </div>
  );
}

/** Keeps the scene's pending state local to its semantic frame. */
function ProjectileSceneLoading() {
  const t = useTranslations("Features");

  return (
    <div
      aria-label={t("projectile-view-label")}
      className="flex size-full items-center justify-center"
      role="status"
    >
      <Spinner aria-hidden="true" className="size-6" />
    </div>
  );
}

/**
 * Imports the scene module after viewport intent.
 *
 * @see https://nextjs.org/docs/app/guides/lazy-loading
 */
const ProjectileScene = dynamic(
  () =>
    Effect.runPromise(
      loadProjectileScene(() =>
        import("@/components/marketing/about/projectile/scene").then(
          ({ ProjectileScene: Scene }) => Scene
        )
      ).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            reportClientException(error, {
              operation: "load-projectile-scene",
              source: "home-features",
            }).pipe(Effect.as(UnavailableProjectileScene)),
          onSuccess: Effect.succeed,
        })
      )
    ),
  { loading: ProjectileSceneLoading }
);

interface ProjectileFact {
  readonly id: string;
  readonly label: ReactNode;
  readonly value: ReactNode;
}

interface ProjectileOption {
  readonly facts: readonly ProjectileFact[];
  readonly id: ProjectileScenarioId;
  readonly label: ReactNode;
  readonly motion: ProjectileMotionState;
}

interface ProjectileClientProps {
  readonly controlsLabel: string;
  readonly initialScenario: ProjectileOption;
  readonly scenarios: readonly ProjectileOption[];
  readonly title: ReactNode;
  readonly viewLabel: string;
}

/** Keeps all projectile interactions while hydrating only their control state. */
export function ProjectileClient({
  controlsLabel,
  initialScenario,
  scenarios,
  title,
  viewLabel,
}: ProjectileClientProps) {
  const { ref, entry } = useIntersection({
    root: null,
    rootMargin: "400px 0px",
    threshold: 0.01,
  });
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const activeScenario =
    scenarios.find(({ id }) => id === scenarioId) ?? initialScenario;

  /** Selects a verified projectile scenario for the interactive lesson scene. */
  function handleScenarioChange(value: string) {
    const scenario = scenarios.find(({ id }) => id === value);
    if (!scenario) {
      return;
    }

    setScenarioId(scenario.id);
  }

  return (
    <div
      className="relative flex min-h-[42rem] flex-col overflow-hidden bg-background lg:col-span-7 lg:min-h-[44rem]"
      ref={ref}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-8 p-8 lg:p-10">
        <h3 className="max-w-2xl text-balance text-3xl tracking-tight sm:text-4xl">
          {title}
        </h3>

        <div className="mt-auto flex flex-col gap-4">
          <ToggleGroup
            aria-label={controlsLabel}
            gridColumns="3"
            onValueChange={handleScenarioChange}
            type="single"
            value={scenarioId}
            variant="outline"
          >
            {scenarios.map((scenario) => (
              <ToggleGroupItem key={scenario.id} value={scenario.id}>
                {scenario.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <section aria-label={viewLabel} className={threeSceneFrameVariants()}>
            {entry?.isIntersecting && (
              <ProjectileScene
                motion={activeScenario.motion}
                shouldReduceMotion={shouldReduceMotion}
              />
            )}
          </section>
        </div>
      </div>

      <div className="border-t p-8 lg:p-10">
        <dl className="grid w-full grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {activeScenario.facts.map((fact) => (
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
