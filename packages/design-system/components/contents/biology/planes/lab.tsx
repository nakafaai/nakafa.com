"use client";

import type {
  Pair,
  Plane,
  Section,
  Subject,
} from "@repo/design-system/components/contents/biology/planes/anatomy";
import {
  PAIRS,
  PLANES,
  SECTIONS,
} from "@repo/design-system/components/contents/biology/planes/anatomy";
import { PlanesScene } from "@repo/design-system/components/contents/biology/planes/scene";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface PlaneCopy {
  readonly name: string;
  readonly separates: NonNullable<ReactNode>;
}

interface PairCopy {
  readonly meaning: NonNullable<ReactNode>;
  readonly name: string;
}

interface BodyPlanesLabProps {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly pair?: string;
    readonly pairs?: Readonly<Record<Pair, PairCopy>>;
    readonly plane?: string;
    readonly planes?: Readonly<Record<Plane, PlaneCopy>>;
    readonly position: string;
    readonly section?: string;
    readonly sections?: Readonly<Record<Section, string>>;
    readonly subject: string;
    readonly subjects: Readonly<Partial<Record<Subject, string>>>;
    readonly view: string;
  };
  readonly subjects: readonly [Subject, ...Subject[]];
  readonly title: NonNullable<ReactNode>;
}

/**
 * Interactive 3D exploration of anatomical body planes, paired direction
 * terms, and dicot stem transverse versus longitudinal sections.
 */
export function BodyPlanesLab({
  description,
  labels,
  subjects,
  title,
}: BodyPlanesLabProps) {
  const [subject, setSubject] = useState<Subject>(subjects[0]);
  const [plane, setPlane] = useState<Plane>("sagittal");
  const [pair, setPair] = useState<Pair>("vertical");
  const [section, setSection] = useState<Section>("transverse");
  const [position, setPosition] = useState(0);

  const activePlane = labels.planes?.[plane];
  const activePair = labels.pairs?.[pair];
  const activeSection = labels.sections?.[section];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSubject(subjects[0]);
          setPlane("sagittal");
          setPair("vertical");
          setSection("transverse");
          setPosition(0);
        }}
      />

      <VisualCardToolbar>
        {subjects.length > 1 && (
          <ToggleGroup
            aria-label={labels.subject}
            onValueChange={(next) => {
              if (next === "body" || next === "stem") {
                setSubject(next);
                setPosition(0);
              }
            }}
            size="sm"
            type="single"
            value={subject}
          >
            {Arr.map(subjects, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.subjects[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {subject === "body" && labels.planes !== undefined && (
          <ToggleGroup
            aria-label={labels.plane ?? labels.subject}
            onValueChange={(next) => {
              if (
                next === "sagittal" ||
                next === "frontal" ||
                next === "transverse"
              ) {
                setPlane(next);
                setPosition(0);
              }
            }}
            size="sm"
            type="single"
            value={plane}
          >
            {Arr.map(PLANES, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.planes?.[id].name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {subject === "body" && labels.pairs !== undefined && (
          <ToggleGroup
            aria-label={labels.pair ?? labels.subject}
            onValueChange={(next) => {
              if (
                next === "vertical" ||
                next === "front" ||
                next === "side" ||
                next === "limb"
              ) {
                setPair(next);
              }
            }}
            size="sm"
            type="single"
            value={pair}
          >
            {Arr.map(PAIRS, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.pairs?.[id].name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {subject === "stem" && labels.sections !== undefined && (
          <ToggleGroup
            aria-label={labels.section ?? labels.subject}
            onValueChange={(next) => {
              if (next === "transverse" || next === "longitudinal") {
                setSection(next);
                setPosition(0);
              }
            }}
            size="sm"
            type="single"
            value={section}
          >
            {Arr.map(SECTIONS, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.sections?.[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <VisualSlider
          heading={labels.position}
          label={labels.position}
          max={1}
          min={-1}
          onValueChange={setPosition}
          pauseOnChange
          step={0.05}
          value={position}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2} setting="studio">
          <Suspense fallback={null}>
            <PlanesScene
              onPosition={setPosition}
              pair={pair}
              pairLabel={activePair?.name}
              plane={plane}
              planeLabel={activePlane?.name}
              position={position}
              section={section}
              sectionLabel={activeSection}
              subject={subject}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {subject === "body" && activePlane !== undefined && (
            <VisualFact
              label={activePlane.name}
              value={activePlane.separates}
            />
          )}
          {subject === "body" && activePair !== undefined && (
            <VisualFact label={activePair.name} value={activePair.meaning} />
          )}
          {subject === "stem" &&
            labels.section !== undefined &&
            activeSection !== undefined && (
              <VisualFact label={labels.section} value={activeSection} />
            )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
