"use client";

import { useReducedMotion } from "@mantine/hooks";
import type {
  ProjectileMotionState,
  ProjectileScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  VisualCard,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { Array as Arr, Effect, Option } from "effect";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { loadProjectileScene } from "@/components/marketing/about/projectile/loader";
import type { ProjectileSceneProps } from "@/components/marketing/about/projectile/scene";
import { reportClientException } from "@/lib/analytics/client";

const PROJECTILE_PRELOAD_MARGIN = 400;

/** How long one trajectory flies before the next one takes its turn. */
const TRAJECTORY_INTERVAL_MS = 6000;

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

/** Keeps the scene's pending state local to its frame. */
function ProjectileSceneLoading() {
  const t = useTranslations("Landing");

  return (
    <div
      aria-label={t("scene-label")}
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
              source: "home-scene",
            }).pipe(Effect.as(UnavailableProjectileScene)),
          onSuccess: Effect.succeed,
        })
      )
    ),
  { loading: ProjectileSceneLoading }
);

/** One trajectory of the scene, with the numbers that describe it. */
interface ProjectileScenario {
  readonly facts: readonly {
    readonly id: string;
    readonly label: ReactNode;
    readonly value: ReactNode;
  }[];
  readonly id: ProjectileScenarioId;
  readonly label: ReactNode;
  readonly motion: ProjectileMotionState;
}

interface ProjectileClientProps {
  readonly initialScenario: ProjectileScenario;
  readonly lead: string;
  readonly scenarios: readonly ProjectileScenario[];
  readonly talk: ReactNode;
  readonly title: string;
  readonly viewLabel: string;
}

/** Matches the scene's preload box against current viewport geometry. */
function isSceneNearViewport(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();

  return (
    bounds.bottom > bounds.top &&
    bounds.right > bounds.left &&
    bounds.bottom > -PROJECTILE_PRELOAD_MARGIN &&
    bounds.top < window.innerHeight + PROJECTILE_PRELOAD_MARGIN &&
    bounds.right > 0 &&
    bounds.left < window.innerWidth
  );
}

/** Tracks scene activity from observer and current viewport geometry. */
function useProjectileSceneVisibility() {
  const sceneFrameRef = useRef<HTMLDivElement>(null);
  const [sceneVisible, setSceneVisible] = useState(false);

  useEffect(() => {
    const sceneFrame = sceneFrameRef.current;
    if (!sceneFrame) {
      return;
    }
    const sceneTarget = sceneFrame;

    function updateSceneVisibility() {
      setSceneVisible(isSceneNearViewport(sceneTarget));
    }

    const observer = new IntersectionObserver(updateSceneVisibility, {
      root: null,
      rootMargin: `${PROJECTILE_PRELOAD_MARGIN}px 0px`,
      threshold: 0,
    });

    observer.observe(sceneTarget);
    window.addEventListener("resize", updateSceneVisibility);
    window.addEventListener("scroll", updateSceneVisibility, {
      passive: true,
    });
    updateSceneVisibility();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSceneVisibility);
      window.removeEventListener("scroll", updateSceneVisibility);
    };
  }, []);

  return { sceneFrameRef, sceneVisible };
}

/**
 * The lesson scene from edge to edge. Its title and the chat sit in the sky, and
 * its numbers in the water. The trajectories fly in turn while the scene is on
 * screen, and the scene holds still with reduced motion.
 */
export function ProjectileClient({
  initialScenario,
  lead,
  scenarios,
  talk,
  title,
  viewLabel,
}: ProjectileClientProps) {
  const { sceneFrameRef, sceneVisible } = useProjectileSceneVisibility();
  const shouldReduceMotion = useReducedMotion();
  const playing = sceneVisible && !shouldReduceMotion;
  const [index, setIndex] = useState(() =>
    Option.getOrElse(
      Arr.findFirstIndex(
        scenarios,
        (scenario) => scenario.id === initialScenario.id
      ),
      () => 0
    )
  );
  const active = Option.getOrElse(
    Arr.get(scenarios, index),
    () => initialScenario
  );

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % scenarios.length);
    }, TRAJECTORY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, scenarios.length]);

  return (
    <VisualCard
      aria-label={viewLabel}
      className="relative isolate h-svh max-h-230 min-h-120 overflow-hidden rounded-none border-0 bg-background py-0 shadow-none ring-0"
      id="scene"
    >
      <VisualCardScene className="absolute inset-0">
        <div className="size-full" ref={sceneFrameRef}>
          {sceneVisible && (
            <ProjectileScene
              motion={active.motion}
              shouldReduceMotion={shouldReduceMotion}
            />
          )}
        </div>
      </VisualCardScene>

      <div className="pointer-events-none absolute inset-x-0 top-0 grid gap-6 p-6 lg:p-10">
        <div className="pointer-events-auto justify-self-start">{talk}</div>
        <div className="grid max-w-2xl gap-2">
          <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="text-pretty text-base">{lead}</p>
        </div>
      </div>

      <VisualCardFooter className="absolute end-6 top-6 border-0 bg-transparent p-0 lg:end-10 lg:top-10">
        <VisualCardFullscreen />
      </VisualCardFooter>

      <dl className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-2 gap-x-6 gap-y-3 p-6 text-sm sm:grid-cols-3 lg:p-10 xl:grid-cols-6">
        {Arr.map(active.facts, (fact) => (
          <div className="flex min-w-0 flex-col gap-1" key={fact.id}>
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="wrap-break-word text-foreground tabular-nums">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </VisualCard>
  );
}
