"use client";

import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { Property } from "@repo/design-system/components/contents/biology/water/bonds";
import {
  capillaryRiseMeters,
  ETHANOL_SPECIFIC_HEAT,
  temperatureRise,
  WATER_SPECIFIC_HEAT,
} from "@repo/design-system/components/contents/biology/water/bonds";
import { WaterScene } from "@repo/design-system/components/contents/biology/water/scene";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface WaterBondLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly heat: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly ethanol?: NonNullable<ReactNode>;
    readonly heat: string;
    readonly parts: Readonly<
      Record<"oxygen" | "hydrogen" | "bond" | "wall", string>
    >;
    readonly properties: Readonly<Partial<Record<Property, string>>>;
    readonly property: string;
    readonly radius: string;
    readonly rise?: NonNullable<ReactNode>;
    readonly view: string;
    readonly water?: NonNullable<ReactNode>;
  };
  readonly mass: number;
  readonly properties: readonly [Property, ...Property[]];
  readonly radius: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive molecular workbench exploring hydrogen bonding in water:
 * cohesion in narrow xylem tubes, adhesion on hydrophilic walls, and high
 * specific heat capacity compared with ethanol.
 */
export function WaterBondLab({
  description,
  heat,
  labels,
  mass,
  properties,
  radius,
  title,
}: WaterBondLabProps) {
  const [property, setProperty] = useState<Property>(properties[0]);
  const [radiusUm, setRadiusUm] = useState(radius.value);
  const [heatJ, setHeatJ] = useState(heat.value);

  const riseMeters = capillaryRiseMeters(radiusUm);
  const waterDelta = temperatureRise(heatJ, mass, WATER_SPECIFIC_HEAT);
  const ethanolDelta = temperatureRise(heatJ, mass, ETHANOL_SPECIFIC_HEAT);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setProperty(properties[0]);
          setRadiusUm(radius.value);
          setHeatJ(heat.value);
        }}
      />

      <VisualCardToolbar>
        {properties.length > 1 && (
          <ToggleGroup
            aria-label={labels.property}
            onValueChange={(next) => {
              if (
                next === "cohesion" ||
                next === "adhesion" ||
                next === "heat"
              ) {
                setProperty(next);
              }
            }}
            size="sm"
            type="single"
            value={property}
          >
            {Arr.map(properties, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.properties[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {property === "heat" ? (
          <VisualSlider
            heading={labels.heat}
            label={labels.heat}
            max={heat.max}
            min={heat.min}
            onValueChange={setHeatJ}
            readout={`${heatJ} J`}
            step={Math.max(1, Math.round((heat.max - heat.min) / 40))}
            value={heatJ}
          />
        ) : (
          <VisualSlider
            heading={labels.radius}
            label={labels.radius}
            max={radius.max}
            min={radius.min}
            onValueChange={setRadiusUm}
            readout={`${radiusUm} µm`}
            step={1}
            value={radiusUm}
          />
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.8} setting="studio">
          <Suspense fallback={null}>
            <WaterScene
              bondLabel={labels.parts.bond}
              heatJ={heatJ}
              hydrogenLabel={labels.parts.hydrogen}
              massG={mass}
              oxygenLabel={labels.parts.oxygen}
              property={property}
              radiusMax={radius.max}
              radiusMin={radius.min}
              radiusUm={radiusUm}
              wallLabel={labels.parts.wall}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {property !== "heat" && labels.rise !== undefined && (
            <VisualFactTabular
              label={labels.rise}
              value={`${riseMeters.toFixed(2)} m`}
            />
          )}
          {property === "heat" && labels.water !== undefined && (
            <VisualFactTabular
              label={labels.water}
              value={`+${waterDelta.toFixed(1)} °C`}
            />
          )}
          {property === "heat" && labels.ethanol !== undefined && (
            <VisualFactTabular
              label={labels.ethanol}
              value={`+${ethanolDelta.toFixed(1)} °C`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
