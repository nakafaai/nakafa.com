import {
  BLOCK_SIDES,
  blockReading,
  MaterialSchema,
} from "@repo/design-system/components/contents/physics/measurement/density/block";
import { BlockScene } from "@repo/design-system/components/contents/physics/measurement/density/scene";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
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

interface DensityMeasurementLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseMaterial: string;
    density: ReactNode;
    densitySi: ReactNode;
    mass: ReactNode;
    materials: Record<typeof MaterialSchema.Type, ReactNode>;
    sides: ReactNode;
    viewLabel: string;
    volume: ReactNode;
  };
  title: NonNullable<ReactNode>;
}

/**
 * Three blocks of the same size, pine, aluminium and brass, on a dial scale.
 * A ruler gives three lengths and the scale one mass, all base quantities;
 * the volume and the density are derived from them.
 */
export function DensityMeasurementLab({
  description,
  labels,
  title,
}: DensityMeasurementLabProps) {
  const [material, setMaterial] =
    useState<typeof MaterialSchema.Type>("aluminium");
  const fixed = useFixed();
  const { density, densitySi, mass, volume } = blockReading(material);
  const isMaterial = Schema.is(MaterialSchema);

  return (
    <VisualCard
      onReset={() => {
        setMaterial("aluminium");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMaterial}
          gridColumns="3"
          onValueChange={(value) => {
            if (isMaterial(value)) {
              setMaterial(value);
            }
          }}
          type="single"
          value={material}
          variant="outline"
        >
          {Arr.map(MaterialSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.materials[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.4} setting="lab">
          <Suspense fallback={null}>
            <BlockScene material={material} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.sides}
            value={
              <InlineMath
                math={`${fixed(BLOCK_SIDES.length, "", 1)}\\times${fixed(BLOCK_SIDES.width, "", 1)}\\times${fixed(BLOCK_SIDES.height, "\\text{ cm}", 1)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.volume}
            value={
              <InlineMath math={`V=${fixed(volume, "\\text{ cm}^3", 0)}`} />
            }
          />
          <VisualFactTabular
            label={labels.mass}
            value={<InlineMath math={`m=${fixed(mass, "\\text{ g}", 0)}`} />}
          />
          <VisualFactTabular
            label={labels.density}
            value={
              <InlineMath
                math={`\\rho=\\frac{m}{V}=${fixed(density, "\\text{ g/cm}^3", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.densitySi}
            value={<InlineMath math={fixed(densitySi, "\\text{ kg/m}^3", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
