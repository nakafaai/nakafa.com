"use client";

import { ATOM_SHELL_SAMPLES } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import type { Lesson } from "@/components/marketing/about/lesson/id";
import {
  QUADRATIC_POINTS,
  QUADRATIC_SCENE,
} from "@/components/marketing/about/lesson/quadratic";
import { BacteriaStructureLab } from "@/lib/content/renderer/client/biology/bacteria";
import { AtomShellLab } from "@/lib/content/renderer/client/chemistry/atom";
import { ParabolicMovementLab } from "@/lib/content/renderer/client/physics/parabolic";

/** What every lesson visual receives from the window: the page's decimal separator. */
interface LessonVisualProps {
  readonly decimalSeparator: DecimalSeparator;
}

/** The math visual of the product, loaded when its lesson opens. */
const MathVisual = dynamic(() =>
  import("@/lib/content/renderer/client/base/visual/math").then(
    ({ MathVisual }) => MathVisual
  )
);

/**
 * The projectile lesson's visual: a ball thrown at a chosen angle, in three
 * dimensions. It gets interface labels only; its numbers come from its own data.
 */
function ProjectileVisual({ decimalSeparator }: LessonVisualProps) {
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
    />
  );
}

/** The point as the lesson writes it, such as (1,0). */
function pointMath(point: { readonly x: number; readonly y: number }) {
  return `(${point.x},${point.y})`;
}

/** The quadratic lesson's visual: a parabola with its two roots and its vertex. */
function QuadraticVisual() {
  const t = useTranslations("Landing");

  return (
    <MathVisual
      labels={{
        left: <InlineMath math={pointMath(QUADRATIC_POINTS.left)} />,
        right: <InlineMath math={pointMath(QUADRATIC_POINTS.right)} />,
        vertex: <InlineMath math={pointMath(QUADRATIC_POINTS.vertex)} />,
      }}
      scene={QUADRATIC_SCENE}
      viewLabel={t("lab.quadratic.view")}
    />
  );
}

/** The atom lesson's visual: the shells of a neutral atom, one sample at a time. */
function AtomVisual() {
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
    />
  );
}

/** The cell lesson's visual: the shape, the inside and the wall of a bacterium. */
function BacteriaVisual() {
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
    />
  );
}

/** The product's own visual of each lesson, as a lesson page renders it. */
const VISUALS: Record<Lesson, ComponentType<LessonVisualProps>> = {
  atom: AtomVisual,
  cell: BacteriaVisual,
  projectile: ProjectileVisual,
  quadratic: QuadraticVisual,
};

/**
 * The visual of one lesson of the home page window. The window loads this module
 * only when it nears the screen, so the labs stay out of the first JavaScript.
 * The visual gets interface labels only: the lesson's own words stay in its
 * published page, so the window never copies them.
 */
export function LessonVisual({
  decimalSeparator,
  lesson,
}: LessonVisualProps & { readonly lesson: Lesson }) {
  const Visual = VISUALS[lesson];
  return <Visual decimalSeparator={decimalSeparator} />;
}
