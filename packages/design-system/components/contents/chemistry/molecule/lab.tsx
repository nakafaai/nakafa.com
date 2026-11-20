import { Atom02Icon } from "@hugeicons/core-free-icons";
import type { MoleculeId } from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import {
  getMolecule,
  MoleculeIdSchema,
  moleculeFormula,
} from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import {
  compositionTex,
  massTex,
  shapeTex,
} from "@repo/design-system/components/contents/chemistry/molecule/facts";
import type { ModelStyle } from "@repo/design-system/components/contents/chemistry/molecule/model";
import {
  MoleculeCamera,
  MoleculeScene,
  moleculeReach,
  readMolecule,
} from "@repo/design-system/components/contents/chemistry/molecule/scene";
import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { DropdownMenuCheckboxItem } from "@repo/design-system/components/ui/dropdown-menu";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { useFormatter } from "use-intl";

/** How far under its lowest atom the floor a molecule casts its shadow on lies. */
const FLOOR_GAP = 0.4;

/** The words a molecule lab reads from its lesson. */
interface MoleculeLabels {
  /** The readout of the atoms in the molecule. */
  readonly atoms: ReactNode;
  /** The name of the toggle that chooses a molecule, for assistive technology. */
  readonly choose: string;
  /** The menu choice that draws the atoms at their true size. */
  readonly fill: ReactNode;
  /** The readout of the formula. */
  readonly formula: ReactNode;
  /** The readout of the relative molecular mass. */
  readonly mass: ReactNode;
  /** The readout of the bond angle, or the bond length of two atoms. */
  readonly shape: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * A molecule lab: the real shape of each molecule the lesson names, built from
 * its measured bond lengths and angles, as polished model-kit atoms the reader
 * can turn, or as space-filling atoms at their true size. The footer reads the
 * formula, the atoms, the relative molecular mass, and the bond angle measured
 * off the drawn model.
 *
 * @param molecules - Each molecule to offer, in order: its catalog id and its name in the lesson's language
 */
export function MoleculeShapeLab({
  description,
  labels,
  molecules,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: MoleculeLabels;
  readonly molecules: readonly {
    readonly id: MoleculeId;
    readonly name: string;
  }[];
  readonly title: NonNullable<ReactNode>;
}) {
  const format = useFormatter();
  const offered = Arr.filter(molecules, (entry) =>
    Schema.is(MoleculeIdSchema)(entry.id)
  );
  const [chosen, setChosen] = useState<MoleculeId | undefined>(undefined);
  const [style, setStyle] = useState<ModelStyle>("ball");
  const entry = Arr.findFirst(offered, (each) => each.id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );
  const molecule =
    entry === undefined ? undefined : readMolecule(getMolecule(entry.id));

  if (entry === undefined || molecule === undefined) {
    return null;
  }
  const shown = entry.id;

  const number = (value: number) =>
    mathNumber(format.number(value, "math", { maximumFractionDigits: 1 }));

  function choose(value: string) {
    if (Schema.is(MoleculeIdSchema)(value)) {
      setChosen(value);
    }
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {offered.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.choose}
            gridColumns={toggleColumns(offered.length)}
            onValueChange={choose}
            type="single"
            value={shown}
            variant="outline"
          >
            {Arr.map(offered, (each) => (
              <ToggleGroupItem
                aria-label={each.name}
                key={each.id}
                value={each.id}
              >
                {isomeric(
                  Arr.map(offered, (other) => other.id),
                  each.id
                ) ? (
                  each.name
                ) : (
                  <InlineMath math={moleculeFormula(each.id)} />
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={`${labels.view}: ${entry.name}`}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={-moleculeReach(molecule, style) - FLOOR_GAP}
          reach={moleculeReach(molecule, style) + 1}
          setting="studio"
        >
          <Suspense>
            <MoleculeCamera reach={moleculeReach(molecule, style)} />
            <MoleculeScene molecule={molecule} style={style} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions>
        <DropdownMenuCheckboxItem
          checked={style === "fill"}
          closeOnClick
          icon={Atom02Icon}
          onCheckedChange={(checked) => setStyle(checked ? "fill" : "ball")}
        >
          {labels.fill}
        </DropdownMenuCheckboxItem>
      </VisualCardSceneActions>

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.formula}
            value={<InlineMath math={molecule.formula} />}
          />
          <VisualFact
            label={labels.atoms}
            value={<InlineMath math={compositionTex(shown)} />}
          />
          <VisualFact
            label={labels.mass}
            value={<InlineMath math={massTex(shown, number)} />}
          />
          <VisualFact
            label={labels.shape}
            value={Option.match(shapeTex(molecule, number), {
              onNone: () => null,
              onSome: (tex) => <InlineMath math={tex} />,
            })}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Whether another offered molecule shares this one's formula, as isomers do,
 * so the toggle names each one instead of repeating the formula.
 */
function isomeric(offered: readonly MoleculeId[], id: MoleculeId) {
  return (
    Arr.filter(offered, (each) => moleculeFormula(each) === moleculeFormula(id))
      .length > 1
  );
}
