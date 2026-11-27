import { BulbNetworkScene } from "@repo/design-system/components/contents/physics/circuit/bulbs/scene";
import { bulbNetwork } from "@repo/design-system/components/contents/physics/circuit/current";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface BulbNetworkLabProps {
  description: NonNullable<ReactNode>;
  /** The e.m.f. of the battery, which has negligible internal resistance, in volts. */
  emf: number;
  /** The resistances, in ohms, of the bulbs in parallel; the last one is the bulb that can break. */
  group: readonly [number, number, ...number[]];
  labels: {
    broken: ReactNode;
    intact: ReactNode;
    state: string;
    viewLabel: string;
  };
  /** The resistance of the bulb in series with the group, in ohms. */
  series: number;
  title: NonNullable<ReactNode>;
}

/**
 * A battery lights one bulb in series with a group of bulbs in parallel, each
 * glowing with its own power on an oak board. Break the filament of the
 * last bulb in the group: the group's resistance rises, the battery's current
 * falls, the series bulb dims, and the bulbs left in the group take a larger
 * share of the voltage and brighten.
 */
export function BulbNetworkLab({
  description,
  emf,
  group,
  labels,
  series,
  title,
}: BulbNetworkLabProps) {
  const quantity = useQuantity();
  const [broken, setBroken] = useState(false);
  const last = group.length - 1;
  const network = bulbNetwork(
    emf,
    series,
    Arr.map(group, (resistance, index) => ({
      broken: broken && index === last,
      resistance,
    }))
  );

  return (
    <VisualCard
      onReset={() => {
        setBroken(false);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.state}
          onValueChange={(value) => setBroken(value === "broken")}
          type="single"
          value={broken ? "broken" : "intact"}
          variant="outline"
        >
          <ToggleGroupItem value="intact">{labels.intact}</ToggleGroupItem>
          <ToggleGroupItem value="broken">{labels.broken}</ToggleGroupItem>
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.6} setting="lab">
          <Suspense fallback={null}>
            <BulbNetworkScene
              broken={broken}
              emf={emf}
              group={group}
              series={series}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          {Arr.map(
            Arr.map(network.bulbs, (bulb, index) => ({
              ...bulb,
              name: `L_{${index + 1}}`,
            })),
            (bulb) => (
              <VisualFactTabular
                key={bulb.name}
                label={<InlineMath math={bulb.name} />}
                value={
                  <InlineMath
                    math={`${quantity(bulb.voltage, "\\text{ V}", 2)},\\ ${quantity(bulb.power, "\\text{ W}", 2)}`}
                  />
                }
              />
            )
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
