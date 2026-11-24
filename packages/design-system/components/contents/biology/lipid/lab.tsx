"use client";

import type {
  Chain,
  Molecule,
  Scale,
} from "@repo/design-system/components/contents/biology/lipid/packing";
import {
  roomState,
  SCALES,
  waterForm,
} from "@repo/design-system/components/contents/biology/lipid/packing";
import { LipidScene } from "@repo/design-system/components/contents/biology/lipid/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface LipidLabProps {
  readonly chains: readonly [Chain, ...Chain[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly bilayer: NonNullable<ReactNode>;
    readonly chain: string;
    readonly chains: Readonly<Partial<Record<Chain, string>>>;
    readonly droplet: NonNullable<ReactNode>;
    readonly form: NonNullable<ReactNode>;
    readonly liquid: NonNullable<ReactNode>;
    readonly molecule: string;
    readonly molecules: Readonly<Partial<Record<Molecule, string>>>;
    readonly parts: Readonly<
      Record<
        "glycerol" | "fatty" | "ester" | "phosphate" | "head" | "tail" | "kink",
        string
      >
    >;
    readonly scale: string;
    readonly scales: Readonly<Record<Scale, string>>;
    readonly solid: NonNullable<ReactNode>;
    readonly state: NonNullable<ReactNode>;
    readonly view: string;
  };
  readonly molecules: readonly [Molecule, ...Molecule[]];
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive lipid workbench comparing saturated versus unsaturated fatty
 * acid packing and triglyceride droplets versus phospholipid bilayers in water.
 */
export function LipidLab({
  chains,
  description,
  labels,
  molecules,
  title,
}: LipidLabProps) {
  const [molecule, setMolecule] = useState<Molecule>(molecules[0]);
  const [chain, setChain] = useState<Chain>(chains[0]);
  const [scale, setScale] = useState<Scale>("molecule");

  const physicalState =
    roomState(chain) === "solid" ? labels.solid : labels.liquid;
  const aqueousForm =
    waterForm(molecule) === "droplet" ? labels.droplet : labels.bilayer;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setMolecule(molecules[0]);
          setChain(chains[0]);
          setScale("molecule");
        }}
      />

      <VisualCardToolbar>
        {molecules.length > 1 && (
          <ToggleGroup
            aria-label={labels.molecule}
            onValueChange={(next) => {
              if (next === "triglyceride" || next === "phospholipid") {
                setMolecule(next);
              }
            }}
            size="sm"
            type="single"
            value={molecule}
          >
            {Arr.map(molecules, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.molecules[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {chains.length > 1 && (
          <ToggleGroup
            aria-label={labels.chain}
            onValueChange={(next) => {
              if (next === "saturated" || next === "unsaturated") {
                setChain(next);
              }
            }}
            size="sm"
            type="single"
            value={chain}
          >
            {Arr.map(chains, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.chains[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <ToggleGroup
          aria-label={labels.scale}
          onValueChange={(next) => {
            if (next === "molecule" || next === "water") {
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
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.9} setting="studio">
          <Suspense fallback={null}>
            <LipidScene
              chain={chain}
              molecule={molecule}
              parts={labels.parts}
              scale={scale}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.state} value={physicalState} />
          <VisualFact label={labels.form} value={aqueousForm} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
