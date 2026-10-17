import type { BacteriaLabItemProps } from "@repo/design-system/components/contents/biology/bacteria-scene";
import { ATOM_SHELL_SAMPLES } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import type { useTranslations } from "next-intl";

/** A translator of the Landing namespace, which the server and the client both hold. */
type LandingTranslator = ReturnType<typeof useTranslations<"Landing">>;

/**
 * The labels of the atom lab. Its static card and its live lab both take them
 * from here, so each label is written once.
 */
export function getAtomLabels(t: LandingTranslator) {
  return {
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
  };
}

/**
 * The labels of the cell lab, with its three views in the order the lab draws
 * them. The static card takes the same items, so its first view matches the lab.
 */
export function getCellLabels(t: LandingTranslator) {
  return {
    chooseMode: t("lab.bacteria.choose"),
    items: [
      { scene: { kind: "shape" }, tab: t("lab.bacteria.shape.tab") },
      { scene: { kind: "structure" }, tab: t("lab.bacteria.inside.tab") },
      { scene: { kind: "wall" }, tab: t("lab.bacteria.wall.tab") },
    ] satisfies readonly [BacteriaLabItemProps, ...BacteriaLabItemProps[]],
    viewLabel: t("lab.bacteria.view"),
  };
}

/** The labels of the projectile lab, which its static card shares. */
export function getProjectileLabels(t: LandingTranslator) {
  return {
    chooseLaunch: t("lab.projectile.choose"),
    factLabels: {
      flightTime: t("lab.projectile.flight-time"),
      initialSpeed: t("lab.projectile.initial-speed"),
      peakHeight: t("lab.projectile.peak-height"),
      range: t("lab.projectile.range"),
    },
    viewLabel: t("lab.projectile.view"),
  };
}
