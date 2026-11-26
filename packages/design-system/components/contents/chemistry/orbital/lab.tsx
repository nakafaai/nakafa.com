import {
  BOHR,
  OrbitalAxes,
  OrbitalCamera,
  OrbitalCloud,
} from "@repo/design-system/components/contents/chemistry/orbital/scene";
import type { OrbitalId } from "@repo/design-system/components/contents/chemistry/orbital/wave";
import {
  OrbitalIdSchema,
  orbitalNumbers,
  orbitalReach,
  radialNodes,
} from "@repo/design-system/components/contents/chemistry/orbital/wave";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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

/** The words an orbital lab reads from its lesson. */
interface OrbitalLabels {
  /** The readout of the planes and cones where the cloud vanishes. */
  readonly angular: ReactNode;
  /** The name of the toggle that chooses an orbital, for assistive technology. */
  readonly choose: string;
  /** The readout of the quantum numbers. */
  readonly numbers: ReactNode;
  /** The readout of the orbital's name. */
  readonly orbital: ReactNode;
  /** The readout of the spheres where the cloud vanishes. */
  readonly radial: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * An orbital lab: the electron cloud of a hydrogen orbital, thousands of
 * points crowding where the electron is most likely to be found, sampled from
 * the real wave function. Lobes of one sign glow amber and of the other
 * violet, with nodal planes/cones and radial rings showing where psi = 0.
 */
export function OrbitalCloudLab({
  description,
  labels,
  orbitals,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: OrbitalLabels;
  readonly orbitals: readonly OrbitalId[];
  readonly title: NonNullable<ReactNode>;
}) {
  const offered = Arr.filter(orbitals, (id) => Schema.is(OrbitalIdSchema)(id));
  const [chosen, setChosen] = useState<OrbitalId | undefined>(undefined);
  const shown = Arr.findFirst(offered, (id) => id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const { l, n, tex } = orbitalNumbers(shown);
  const widest = Arr.reduce(offered, 0, (reach, id) =>
    Math.max(reach, orbitalReach(id) * BOHR)
  );

  function choose(value: string) {
    if (Schema.is(OrbitalIdSchema)(value)) {
      setChosen(value);
    }
  }

  return (
    <VisualCard onReset={() => setChosen(undefined)}>
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
            {Arr.map(offered, (id) => (
              <ToggleGroupItem
                aria-label={orbitalNumbers(id).tex}
                key={id}
                value={id}
              >
                <InlineMath math={orbitalNumbers(id).tex} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={`${labels.view}: ${tex}`}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={widest + 0.8} setting="studio">
          <Suspense>
            <OrbitalCamera reach={widest} />
            <OrbitalCloud id={shown} />
            <OrbitalAxes />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.orbital}
            value={<InlineMath math={tex} />}
          />
          <VisualFact
            label={labels.numbers}
            value={<InlineMath math={`n = ${n},\\ \\ell = ${l}`} />}
          />
          <VisualFact
            label={labels.radial}
            value={<InlineMath math={`${radialNodes(shown)}`} />}
          />
          <VisualFact
            label={labels.angular}
            value={<InlineMath math={`${l}`} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
