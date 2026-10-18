"use client";

import { useReducedMotion } from "@mantine/hooks";
import type {
  ProjectileMotionState,
  ProjectileScenarioId,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
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
  readonly chooseLabel: string;
  readonly lead: string;
  /** Every trajectory, the default one first, so the scene opens on it. */
  readonly scenarios: Arr.NonEmptyReadonlyArray<ProjectileScenario>;
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
 * The lesson scene on the card every lesson visual uses: its title and lead,
 * the trajectories to choose from, the scene alone, the full screen action,
 * and the numbers of the trajectory under it. The trajectories fly in turn
 * while the scene is on screen until the reader chooses one, and the scene
 * holds still with reduced motion.
 */
export function ProjectileClient({
  chooseLabel,
  lead,
  scenarios,
  title,
  viewLabel,
}: ProjectileClientProps) {
  const { sceneFrameRef, sceneVisible } = useProjectileSceneVisibility();
  const shouldReduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(false);
  const playing = sceneVisible && !shouldReduceMotion && !chosen;
  const active = scenarios[index % scenarios.length];

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % scenarios.length);
    }, TRAJECTORY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, scenarios.length]);

  /** Shows the trajectory the reader chose, and stops the turns. */
  function choose(value: string) {
    const next = Arr.findFirstIndex(
      scenarios,
      (scenario) => scenario.id === value
    );
    if (Option.isNone(next)) {
      return;
    }
    setChosen(true);
    setIndex(next.value);
  }

  return (
    <VisualCard id="scene-card">
      {/* The scene is a section of the home page, so its title is a heading. */}
      <VisualCardHeader description={<p>{lead}</p>} title={<h2>{title}</h2>} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={chooseLabel}
          gridColumns="3"
          onValueChange={choose}
          type="single"
          value={active.id}
          variant="outline"
        >
          {Arr.map(scenarios, (scenario) => (
            <ToggleGroupItem key={scenario.id} value={scenario.id}>
              {scenario.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={viewLabel}
        className="aspect-video min-h-72 overflow-hidden"
        render={<section />}
      >
        <div className="size-full" ref={sceneFrameRef}>
          {sceneVisible && (
            <ProjectileScene
              motion={active.motion}
              shouldReduceMotion={shouldReduceMotion}
            />
          )}
        </div>
      </VisualCardBody>
      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>
      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(active.facts, (fact) => (
            <VisualFactTabular
              key={fact.id}
              label={fact.label}
              value={fact.value}
            />
          ))}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
