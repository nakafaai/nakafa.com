"use client";

import { ATOM_SHELL_SAMPLES } from "@repo/design-system/components/contents/chemistry/atom-shell/data";
import { AtomShellLab } from "@repo/design-system/components/contents/chemistry/atom-shell/lab";
import { useTranslations } from "next-intl";

/** The atom lesson's lab: the shells of a neutral atom, one sample at a time. */
export function AtomLesson() {
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
