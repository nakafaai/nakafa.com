"use client";

import { ATOM_SHELL_SAMPLES } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import type { DecimalSeparator } from "@repo/design-system/components/contents/physics/kinematics/number";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import type { Lesson } from "@/components/marketing/about/lesson/id";
import type { HomeLesson } from "@/components/marketing/about/lesson/published";
import { BacteriaStructureLab } from "@/lib/content/renderer/client/biology/bacteria";
import { AtomShellLab } from "@/lib/content/renderer/client/chemistry/atom";
import { UnitCircle } from "@/lib/content/renderer/client/mathematics/geometry";
import { ParabolicMovementLab } from "@/lib/content/renderer/client/physics/parabolic";

/**
 * What every lesson visual receives from the window: the page's decimal separator,
 * and the lesson as Aksara published it for the page's locale.
 */
interface LessonVisualProps {
  readonly decimalSeparator: DecimalSeparator;
  readonly published: HomeLesson;
}

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

/**
 * The circle lesson's visual: the renderer's unit circle. Its card names the
 * lesson with the title and description that Aksara published for it.
 */
function CircleVisual({ published }: LessonVisualProps) {
  return (
    <UnitCircle description={published.description} title={published.title} />
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
  circle: CircleVisual,
  projectile: ProjectileVisual,
};

/**
 * The visual of one lesson of the home page window. The window loads this module
 * only when it nears the screen, so the labs stay out of the first JavaScript.
 * Each visual gets interface labels only, so the lesson's own words stay in its
 * published page. The circle is the one exception: its card shows the title and
 * description that Aksara published, read from the publication and never written
 * into Nakafa.
 */
export function LessonVisual({
  decimalSeparator,
  lesson,
  published,
}: LessonVisualProps & { readonly lesson: Lesson }) {
  const Visual = VISUALS[lesson];
  return <Visual decimalSeparator={decimalSeparator} published={published} />;
}
