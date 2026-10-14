"use client";

import { ATOM_SHELL_SAMPLES } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  QUADRATIC_POINTS,
  QUADRATIC_SCENE,
} from "@/components/marketing/about/lesson/quadratic";
import { BacteriaStructureLab } from "@/lib/content/renderer/client/biology/bacteria";
import { AtomShellLab } from "@/lib/content/renderer/client/chemistry/atom";
import { ParabolicMovementLab } from "@/lib/content/renderer/client/physics/parabolic";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { decimalSeparators } from "@/lib/marketing/decimal";

/** Turns the text between the math tags of a translated sentence into a formula. */
const MATH_TAG = {
  math: (chunks: ReactNode) => <InlineMath math={String(chunks)} />,
};

/** The math visual of the product, loaded when its lesson opens. */
const MathVisual = dynamic(() =>
  import("@/lib/content/renderer/client/base/visual/math").then(
    ({ MathVisual }) => MathVisual
  )
);

/** The projectile lesson: a ball thrown at a chosen angle, in three dimensions. */
export function ProjectileVisual() {
  const t = useTranslations("Landing");
  const locale = getLocaleOrThrow(useLocale());

  return (
    <ParabolicMovementLab
      decimalSeparator={decimalSeparators[locale]}
      description={t("lab.projectile.description")}
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
      title={t("lab.projectile.title")}
    />
  );
}

/** The point as the lesson writes it, such as (1,0). */
function pointMath(point: { readonly x: number; readonly y: number }) {
  return `(${point.x},${point.y})`;
}

/** The quadratic lesson: the curve x squared minus four x plus three, with its roots and vertex. */
export function QuadraticVisual() {
  const t = useTranslations("Landing");

  return (
    <MathVisual
      description={t("lab.quadratic.description")}
      labels={{
        left: <InlineMath math={pointMath(QUADRATIC_POINTS.left)} />,
        right: <InlineMath math={pointMath(QUADRATIC_POINTS.right)} />,
        vertex: <InlineMath math={pointMath(QUADRATIC_POINTS.vertex)} />,
      }}
      scene={QUADRATIC_SCENE}
      title={t("lab.quadratic.title")}
    />
  );
}

/** The atom lesson: the shells of a neutral atom, one sample at a time. */
export function AtomVisual() {
  const t = useTranslations("Landing");

  return (
    <AtomShellLab
      description={t.rich("lab.atom.description", MATH_TAG)}
      labels={{
        atomicNumber: t("lab.atom.atomic-number"),
        chooseAtom: t("lab.atom.choose"),
        configuration: t("lab.atom.configuration"),
        electronTotal: t("lab.atom.electron-total"),
        maximumCapacity: t("lab.atom.capacity"),
        outerShell: t("lab.atom.outer-shell"),
        samples: {
          argon: {
            name: t("lab.atom.samples.argon.name"),
            note: t.rich("lab.atom.samples.argon.note", MATH_TAG),
            tab: ATOM_SHELL_SAMPLES.argon.symbol,
          },
          calcium: {
            name: t("lab.atom.samples.calcium.name"),
            note: t.rich("lab.atom.samples.calcium.note", MATH_TAG),
            tab: ATOM_SHELL_SAMPLES.calcium.symbol,
          },
          chlorine: {
            name: t("lab.atom.samples.chlorine.name"),
            note: t.rich("lab.atom.samples.chlorine.note", MATH_TAG),
            tab: ATOM_SHELL_SAMPLES.chlorine.symbol,
          },
          magnesium: {
            name: t("lab.atom.samples.magnesium.name"),
            note: t.rich("lab.atom.samples.magnesium.note", MATH_TAG),
            tab: ATOM_SHELL_SAMPLES.magnesium.symbol,
          },
          neon: {
            name: t("lab.atom.samples.neon.name"),
            note: t.rich("lab.atom.samples.neon.note", MATH_TAG),
            tab: ATOM_SHELL_SAMPLES.neon.symbol,
          },
          potassium: {
            name: t("lab.atom.samples.potassium.name"),
            note: t.rich("lab.atom.samples.potassium.note", MATH_TAG),
            tab: ATOM_SHELL_SAMPLES.potassium.symbol,
          },
        },
      }}
      title={t("lab.atom.title")}
    />
  );
}

/** The cell lesson: the shape, the inside and the wall of a bacterium. */
export function BacteriaVisual() {
  const t = useTranslations("Landing");

  return (
    <BacteriaStructureLab
      description={t("lab.bacteria.description")}
      labels={{
        chooseMode: t("lab.bacteria.choose"),
        focusLabel: t("lab.bacteria.focus"),
        items: [
          {
            caption: t("lab.bacteria.shape.caption"),
            focus: t("lab.bacteria.shape.focus"),
            scene: {
              bacillusLabel: t("lab.bacteria.shape.bacillus"),
              coccusLabel: t("lab.bacteria.shape.coccus"),
              kind: "shape",
              spiralLabel: t("lab.bacteria.shape.spiral"),
            },
            tab: t("lab.bacteria.shape.tab"),
            takeaway: t("lab.bacteria.shape.takeaway"),
          },
          {
            caption: t("lab.bacteria.inside.caption"),
            focus: t("lab.bacteria.inside.focus"),
            scene: {
              kind: "structure",
              nucleoidDnaLabel: t("lab.bacteria.inside.nucleoid-dna"),
            },
            tab: t("lab.bacteria.inside.tab"),
            takeaway: t("lab.bacteria.inside.takeaway"),
          },
          {
            caption: t("lab.bacteria.wall.caption"),
            focus: t("lab.bacteria.wall.focus"),
            scene: {
              gramNegativeLabel: t("lab.bacteria.wall.gram-negative"),
              gramPositiveLabel: t("lab.bacteria.wall.gram-positive"),
              kind: "wall",
            },
            tab: t("lab.bacteria.wall.tab"),
            takeaway: t("lab.bacteria.wall.takeaway"),
          },
        ],
        takeawayLabel: t("lab.bacteria.takeaway"),
        viewLabel: t("lab.bacteria.view"),
      }}
      title={t("lab.bacteria.title")}
    />
  );
}
