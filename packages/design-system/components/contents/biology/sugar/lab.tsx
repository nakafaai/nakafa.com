"use client";

import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  Monomer,
  Polysaccharide,
  Reaction,
  Scale,
  Sugar,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import {
  bondCount,
  REACTIONS,
  SCALES,
} from "@repo/design-system/components/contents/biology/sugar/polymer";
import { SugarScene } from "@repo/design-system/components/contents/biology/sugar/scene";
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

interface GlycosidicBondLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly bond: string;
    readonly bonds?: NonNullable<ReactNode>;
    readonly monomers: Readonly<Record<Monomer, string>>;
    readonly polysaccharide: string;
    readonly polysaccharides: Readonly<Partial<Record<Polysaccharide, string>>>;
    readonly reaction: string;
    readonly reactions: Readonly<Record<Reaction, string>>;
    readonly scale: string;
    readonly scales: Readonly<Record<Scale, string>>;
    readonly sugar: string;
    readonly sugars: Readonly<Partial<Record<Sugar, string>>>;
    readonly units: string;
    readonly view: string;
    readonly water?: NonNullable<ReactNode>;
  };
  readonly polysaccharides: readonly [Polysaccharide, ...Polysaccharide[]];
  readonly sugars: readonly [Sugar, ...Sugar[]];
  readonly title: NonNullable<ReactNode>;
  readonly units: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
}

/**
 * Interactive carbohydrate condensation and hydrolysis workbench covering
 * disaccharide formation (maltose, sucrose, lactose) and polysaccharide
 * architecture (starch, glycogen, cellulose).
 */
export function GlycosidicBondLab({
  description,
  labels,
  polysaccharides,
  sugars,
  title,
  units,
}: GlycosidicBondLabProps) {
  const [scale, setScale] = useState<Scale>("pair");
  const [sugar, setSugar] = useState<Sugar>(sugars[0]);
  const [polysaccharide, setPolysaccharide] = useState<Polysaccharide>(
    polysaccharides[0]
  );
  const [reaction, setReaction] = useState<Reaction>("condensation");
  const [unitCount, setUnitCount] = useState(units.value);

  const activeUnits = scale === "pair" ? 2 : unitCount;
  const links = bondCount(activeUnits);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setScale("pair");
          setSugar(sugars[0]);
          setPolysaccharide(polysaccharides[0]);
          setReaction("condensation");
          setUnitCount(units.value);
        }}
      />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.scale}
          onValueChange={(next) => {
            if (next === "pair" || next === "chain") {
              setScale(next);
            }
          }}
          size="sm"
          type="single"
          value={scale}
        >
          {Arr.map(SCALES, (id) => (
            <ToggleGroupItem key={id} value={id}>
              {labels.scales[id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {scale === "pair" && sugars.length > 1 && (
          <ToggleGroup
            aria-label={labels.sugar}
            onValueChange={(next) => {
              if (
                next === "maltose" ||
                next === "sucrose" ||
                next === "lactose"
              ) {
                setSugar(next);
              }
            }}
            size="sm"
            type="single"
            value={sugar}
          >
            {Arr.map(sugars, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.sugars[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {scale === "pair" && (
          <ToggleGroup
            aria-label={labels.reaction}
            onValueChange={(next) => {
              if (next === "condensation" || next === "hydrolysis") {
                setReaction(next);
              }
            }}
            size="sm"
            type="single"
            value={reaction}
          >
            {Arr.map(REACTIONS, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.reactions[id]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {scale === "chain" && polysaccharides.length > 1 && (
          <ToggleGroup
            aria-label={labels.polysaccharide}
            onValueChange={(next) => {
              if (
                next === "starch" ||
                next === "glycogen" ||
                next === "cellulose"
              ) {
                setPolysaccharide(next);
              }
            }}
            size="sm"
            type="single"
            value={polysaccharide}
          >
            {Arr.map(polysaccharides, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.polysaccharides[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {scale === "chain" && (
          <VisualSlider
            heading={labels.units}
            label={labels.units}
            max={units.max}
            min={units.min}
            onValueChange={setUnitCount}
            readout={`${unitCount}`}
            step={1}
            value={unitCount}
          />
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.9} setting="studio">
          <Suspense fallback={null}>
            <SugarScene
              bondLabel={labels.bond}
              monomerNames={labels.monomers}
              polysaccharide={polysaccharide}
              reaction={reaction}
              scale={scale}
              sugar={sugar}
              units={unitCount}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {labels.bonds !== undefined && (
            <VisualFactTabular label={labels.bonds} value={`${links}`} />
          )}
          {labels.water !== undefined && (
            <VisualFactTabular label={labels.water} value={`${links}`} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
