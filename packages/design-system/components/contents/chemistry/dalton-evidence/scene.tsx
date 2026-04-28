import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import { LayoutGroup } from "motion/react";
import * as m from "motion/react-m";

import type { AtomSymbol, Molecule } from "./data";

/**
 * Renders the selected Dalton evidence as one balanced comparison scene.
 */
export function DaltonEvidenceScene({
  afterMolecules,
  afterTitle,
  beforeMolecules,
  beforeTitle,
  expression,
}: {
  afterMolecules: readonly Molecule[];
  afterTitle: string;
  beforeMolecules: readonly Molecule[];
  beforeTitle: string;
  expression: string;
}) {
  return (
    <LayoutGroup>
      <div className="grid gap-3 py-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <MoleculePanel molecules={beforeMolecules} title={beforeTitle} />
        <ComparisonExpression expression={expression} />
        <MoleculePanel molecules={afterMolecules} title={afterTitle} />
      </div>
    </LayoutGroup>
  );
}

function MoleculePanel({
  molecules,
  title,
}: {
  molecules: readonly Molecule[];
  title: string;
}) {
  return (
    <m.section
      className="flex min-h-36 flex-col items-center justify-center gap-4 p-3 text-center"
      layout
    >
      <div className="font-medium text-muted-foreground text-sm">{title}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
        {molecules.map((molecule) => (
          <MoleculeGroup key={molecule.id} molecule={molecule} />
        ))}
      </div>
    </m.section>
  );
}

function ComparisonExpression({ expression }: { expression: string }) {
  return (
    <m.div className="flex items-center justify-center" layout>
      <span className="inline-flex w-fit shrink-0 items-center justify-center px-2 py-1">
        <InlineMath math={expression} />
      </span>
    </m.div>
  );
}

function MoleculeGroup({ molecule }: { molecule: Molecule }) {
  return (
    <m.div className="grid w-24 justify-items-center gap-2" layout>
      <div className="flex -space-x-2">
        {molecule.atoms.map((atom) => (
          <Atom key={atom.id} symbol={atom.symbol} />
        ))}
      </div>
      <span className="text-muted-foreground">
        <InlineMath math={molecule.label} />
      </span>
    </m.div>
  );
}

function Atom({ symbol }: { symbol: AtomSymbol }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none grid size-9 select-none place-items-center rounded-full border-2 border-background font-semibold text-background shadow-sm"
      style={{ backgroundColor: getAtomColor(symbol) }}
    >
      <InlineMath math={`\\mathrm{${symbol}}`} />
    </span>
  );
}

function getAtomColor(symbol: AtomSymbol) {
  if (symbol === "C") {
    return getColor("SLATE");
  }

  if (symbol === "H") {
    return getColor("CYAN");
  }

  return getColor("ROSE");
}
