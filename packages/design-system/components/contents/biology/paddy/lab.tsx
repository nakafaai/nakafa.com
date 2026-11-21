import { Gases } from "@repo/design-system/components/contents/biology/paddy/gases";
import type {
  Plant,
  Water,
} from "@repo/design-system/components/contents/biology/paddy/oxygen";
import {
  PlantSchema,
  ROOT_DEPTH,
  rootState,
  rootsSurvive,
  soilOxygen,
  WaterSchema,
} from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { PaddyScene } from "@repo/design-system/components/contents/biology/paddy/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/** The water states the toggle offers, flooded first as a paddy normally stands. */
const WATERS = ["flooded", "drained"] as const;

/**
 * A paddy field at real size in endless terrain, its soil and roots seen in
 * X-ray view through the mud: floodwater over grey reduced mud, a crop
 * running back to the haze, the roots of the nearest plants in the mud, an
 * oxygen strip down a measuring stake, and a lens on one root with the
 * oxygen, carbon dioxide and ethanol in it. Flooding the field leaves oxygen
 * only in the top 2 mm of soil, because it moves about 10 000 times more
 * slowly through water than through air. Rice carries air down its roots'
 * air channels (aerenchyma) and stays aerobic; a dryland crop, drawn as
 * maize, has almost none, so its root cells ferment glucose to ethanol and
 * carbon dioxide for 2 ATP instead of `atp`, and its root tips die.
 *
 * @param atp - ATP made from one glucose in aerobic respiration, as the
 * lesson counts it
 * @param plants - The crops the learner can grow, in tab order
 */
export function PaddyRootLab({
  atp,
  description,
  labels,
  plants,
  title,
}: {
  readonly atp: number;
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly damaged: ReactNode;
    readonly ethanol: ReactNode;
    readonly fermentation: ReactNode;
    readonly healthy: ReactNode;
    readonly oxygen: ReactNode;
    readonly parts: {
      readonly aerenchyma: string;
      readonly mud: string;
      readonly root: string;
      readonly water: string;
    };
    readonly plant: string;
    readonly plants: Readonly<Record<Plant, string>>;
    readonly roots: ReactNode;
    readonly view: string;
    readonly water: string;
    readonly waters: Readonly<Record<Water, string>>;
  };
  readonly plants: readonly [Plant, ...Plant[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [water, setWater] = useState<Water>("flooded");
  const [plant, setPlant] = useState<Plant>(plants[0]);
  const quantity = useQuantity();
  const cells = rootState(plant, water, ROOT_DEPTH, atp);
  const soil = soilOxygen(water, ROOT_DEPTH);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setWater("flooded");
          setPlant(plants[0]);
        }}
      />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.water}
          gridColumns={toggleColumns(WATERS.length)}
          onValueChange={(value: string) => {
            if (Schema.is(WaterSchema)(value)) {
              setWater(value);
            }
          }}
          type="single"
          value={water}
          variant="outline"
        >
          {Arr.map(WATERS, (each) => (
            <ToggleGroupItem key={each} value={each}>
              {labels.waters[each]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {plants.length > 1 && (
          <ToggleGroup
            aria-label={labels.plant}
            gridColumns={toggleColumns(plants.length)}
            onValueChange={(value: string) => {
              if (Schema.is(PlantSchema)(value)) {
                setPlant(value);
              }
            }}
            type="single"
            value={plant}
            variant="outline"
          >
            {Arr.map(plants, (each) => (
              <ToggleGroupItem key={each} value={each}>
                {labels.plants[each]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={2} setting="field">
          <Suspense fallback={null}>
            <PaddyScene labels={labels.parts} plant={plant} water={water}>
              <Gases atp={atp} />
            </PaddyScene>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.oxygen}
            value={
              <InlineMath
                math={`${quantity(soil * 100, "\\%", 0)}\\quad(${quantity(ROOT_DEPTH * 100, "\\text{ cm}", 0)})`}
              />
            }
          />
          <VisualFactTabular
            label={labels.fermentation}
            value={<InlineMath math={quantity(cells.energy * 100, "\\%", 0)} />}
          />
          <VisualFactTabular
            label={labels.ethanol}
            value={
              <InlineMath
                math={`${quantity(cells.ethanol, "", 1)}\\;\\mathrm{C_2H_5OH}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.roots}
            value={rootsSurvive(plant, water) ? labels.healthy : labels.damaged}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
