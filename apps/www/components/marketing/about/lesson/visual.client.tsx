"use client";

import { BacteriaStructureLab } from "@repo/design-system/components/contents/biology/bacteria";
import { ATOM_SHELL_SAMPLES } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import { AtomShellLab } from "@repo/design-system/components/contents/chemistry/atom-shell/lab";
import { UnitCircleCard } from "@repo/design-system/components/contents/mathematics/unit-circle";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { ParabolicMovementLab } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import type { Lesson } from "@/components/marketing/about/lesson/id";

/**
 * What every lesson visual receives from the window: the page's decimal separator,
 * and whether the visual's three-dimensional scene is mounted now.
 */
interface LessonVisualProps {
  readonly decimalSeparator: DecimalSeparator;
  readonly live: boolean;
}

/**
 * The projectile lesson's visual: a ball thrown at a chosen angle, in three
 * dimensions. It gets interface labels only; its numbers come from its own data.
 */
function ProjectileVisual({ decimalSeparator, live }: LessonVisualProps) {
  const t = useTranslations("Landing");

  return (
    <ParabolicMovementLab
      decimalSeparator={decimalSeparator}
      labels={{
        chooseLaunch: t("lab.projectile.choose"),
        factLabels: {
          flightTime: t("lab.projectile.flight-time"),
          initialSpeed: t("lab.projectile.initial-speed"),
          peakHeight: t("lab.projectile.peak-height"),
          range: t("lab.projectile.range"),
        },
        viewLabel: t("lab.projectile.view"),
      }}
      live={live}
    />
  );
}

/** The circle lesson's visual: the unit circle, with its angle controls. */
function CircleVisual({ live }: LessonVisualProps) {
  const t = useTranslations("Landing");

  return <UnitCircleCard live={live} viewLabel={t("lab.circle.view")} />;
}

/** The atom lesson's visual: the shells of a neutral atom, one sample at a time. */
function AtomVisual({ live }: LessonVisualProps) {
  const t = useTranslations("Landing");

  return (
    <AtomShellLab
      labels={{
        atomicNumber: t("lab.atom.atomic-number"),
        chooseAtom: t("lab.atom.choose"),
        configuration: t("lab.atom.configuration"),
        electronTotal: t("lab.atom.electron-total"),
        maximumCapacity: t("lab.atom.capacity"),
        outerShell: t("lab.atom.outer-shell"),
        samples: {
          argon: { tab: ATOM_SHELL_SAMPLES.argon.symbol },
          calcium: { tab: ATOM_SHELL_SAMPLES.calcium.symbol },
          chlorine: { tab: ATOM_SHELL_SAMPLES.chlorine.symbol },
          magnesium: { tab: ATOM_SHELL_SAMPLES.magnesium.symbol },
          neon: { tab: ATOM_SHELL_SAMPLES.neon.symbol },
          potassium: { tab: ATOM_SHELL_SAMPLES.potassium.symbol },
        },
      }}
      live={live}
    />
  );
}

/** The cell lesson's visual: the shape, the inside and the wall of a bacterium. */
function BacteriaVisual({ live }: LessonVisualProps) {
  const t = useTranslations("Landing");

  return (
    <BacteriaStructureLab
      labels={{
        chooseMode: t("lab.bacteria.choose"),
        items: [
          {
            scene: { kind: "shape" },
            tab: t("lab.bacteria.shape.tab"),
          },
          {
            scene: { kind: "structure" },
            tab: t("lab.bacteria.inside.tab"),
          },
          {
            scene: { kind: "wall" },
            tab: t("lab.bacteria.wall.tab"),
          },
        ],
        viewLabel: t("lab.bacteria.view"),
      }}
      live={live}
    />
  );
}

/** The product's own visual of each lesson, as a lesson page renders it. */
const VISUALS: Record<Lesson, ComponentType<LessonVisualProps>> = {
  atom: AtomVisual,
  cell: BacteriaVisual,
  circle: CircleVisual,
  projectile: ProjectileVisual,
};

/**
 * The visual of one lesson of the home page window. The window draws every
 * visual at once in one grid cell, so each visual keeps its whole card in place
 * and mounts its three-dimensional scene only while `live` is set. Each visual
 * gets interface labels only: the lesson's own title and description are shown
 * once, by the window, and never drawn by a visual.
 */
export function LessonVisual({
  decimalSeparator,
  lesson,
  live,
}: LessonVisualProps & { readonly lesson: Lesson }) {
  const Visual = VISUALS[lesson];
  return <Visual decimalSeparator={decimalSeparator} live={live} />;
}
