import type {
  BindingModel,
  Disaccharidase,
  Disaccharide,
  Monosaccharide,
} from "@repo/design-system/components/contents/biology/enzyme/model";
import { reactionFor } from "@repo/design-system/components/contents/biology/enzyme/model";
import { ActiveSiteScene } from "@repo/design-system/components/contents/biology/enzyme/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
import {
  VisualFact,
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useCallback, useState } from "react";

export function ActiveSiteLab({
  description,
  enzymes,
  labels,
  models,
  substrates,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly enzymes: readonly [Disaccharidase, ...Disaccharidase[]];
  readonly labels: {
    readonly enzyme: string;
    readonly enzymes: Readonly<Partial<Record<Disaccharidase, string>>>;
    readonly fits: ReactNode;
    readonly model: string;
    readonly models: Readonly<Partial<Record<BindingModel, string>>>;
    readonly no: ReactNode;
    readonly parts: Readonly<Record<"site" | "complex" | "water", string>>;
    readonly products: ReactNode;
    readonly reused: ReactNode;
    readonly substrate: string;
    readonly substrates: Readonly<Partial<Record<Disaccharide, string>>>;
    readonly sugars: Readonly<Record<Monosaccharide, string>>;
    readonly view: string;
    readonly yes: ReactNode;
  };
  readonly models: readonly [BindingModel, ...BindingModel[]];
  readonly substrates: readonly [Disaccharide, ...Disaccharide[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [enzyme, setEnzyme] = useState<Disaccharidase>(enzymes[0]);
  const [substrate, setSubstrate] = useState<Disaccharide>(substrates[0]);
  const [model, setModel] = useState<BindingModel>(models[0]);
  const [reused, setReused] = useState(0);
  const reaction = reactionFor(enzyme, substrate);

  const handleCycleComplete = useCallback(() => {
    setReused((count) => count + 1);
  }, []);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setEnzyme(enzymes[0]);
          setSubstrate(substrates[0]);
          setModel(models[0]);
          setReused(0);
        }}
      />

      <VisualCardToolbar>
        {enzymes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.enzyme}
            gridColumns={toggleColumns(enzymes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(enzymes, (entry) => entry === next),
                (picked) => {
                  setEnzyme(picked);
                  setReused(0);
                }
              );
            }}
            type="single"
            value={enzyme}
            variant="outline"
          >
            {Arr.map(enzymes, (entry) => (
              <ToggleGroupItem key={entry} value={entry}>
                {labels.enzymes[entry] ?? entry}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {substrates.length > 1 ? (
          <ToggleGroup
            aria-label={labels.substrate}
            gridColumns={toggleColumns(substrates.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(substrates, (entry) => entry === next),
                (picked) => {
                  setSubstrate(picked);
                  setReused(0);
                }
              );
            }}
            type="single"
            value={substrate}
            variant="outline"
          >
            {Arr.map(substrates, (entry) => (
              <ToggleGroupItem key={entry} value={entry}>
                {labels.substrates[entry] ?? entry}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {models.length > 1 ? (
          <ToggleGroup
            aria-label={labels.model}
            gridColumns={toggleColumns(models.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(models, (entry) => entry === next),
                setModel
              );
            }}
            type="single"
            value={model}
            variant="outline"
          >
            {Arr.map(models, (entry) => (
              <ToggleGroupItem key={entry} value={entry}>
                {labels.models[entry] ?? entry}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-0.38} reach={2.2} setting="studio">
          <Suspense fallback={null}>
            <ActiveSiteScene
              enzyme={enzyme}
              model={model}
              onCycleComplete={handleCycleComplete}
              parts={labels.parts}
              substrate={substrate}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              reaction.fits ? ENZYME_COLORS.fitYes : ENZYME_COLORS.fitNo
            }
            label={labels.fits}
            value={reaction.fits ? labels.yes : labels.no}
          />
          <VisualFact
            label={labels.products}
            value={
              reaction.fits
                ? Arr.join(
                    Arr.map(reaction.products, (sugar) => labels.sugars[sugar]),
                    " + "
                  )
                : labels.no
            }
          />
          <VisualFactTabular label={labels.reused} value={reused} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
