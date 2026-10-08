"use client";

import { createCircleOutlinePoints } from "@repo/design-system/components/contents/mathematics/circle";
import {
  type RelationMapping,
  resolveRelation,
} from "@repo/design-system/components/contents/mathematics/function/relation";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line-equation";
import {
  VisualCard,
  VisualCardBody,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { COLORS } from "@repo/design-system/lib/color";
import { Array as Arr, Effect } from "effect";
import type { ReactNode } from "react";

interface DiagramProps {
  children: ReactNode;
  description: ReactNode;
  title: ReactNode;
}

/** Frames a relation diagram with the lesson's title and explanation. */
export function Diagram({ title, description, children }: DiagramProps) {
  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <VisualCardBody>{children}</VisualCardBody>
        <CoordinateControls />
      </VisualCard>
    </CoordinateProvider>
  );
}

interface RelationVisualizerProps {
  accessibilityLabel: string;
  /** The codomain's elements, each with the label shown beside it. */
  codomain: { id: string; label: ReactNode }[];
  codomainLabel: ReactNode;
  /** The domain's elements, in the same shape as the codomain's. */
  domain: RelationVisualizerProps["codomain"];
  domainLabel: ReactNode;
  mappings: RelationMapping[];
}

const ELLIPSE_POINTS = Arr.map(createCircleOutlinePoints(1), (point) => ({
  ...point,
  y: point.y * 2.5,
}));

/** Composes set outlines, semantic labels, and exact directed mappings. */
export function RelationVisualizer({
  accessibilityLabel,
  domain,
  codomain,
  mappings,
  domainLabel,
  codomainLabel,
}: RelationVisualizerProps) {
  const relation = Effect.runSync(
    resolveRelation({
      domain: Arr.map(domain, ({ id }) => id),
      codomain: Arr.map(codomain, ({ id }) => id),
      mappings,
    })
  );
  const sets = [
    {
      id: "domain",
      label: domainLabel,
      elements: domain,
      points: relation.domain,
      x: -3,
      color: COLORS.ORANGE,
    },
    {
      id: "codomain",
      label: codomainLabel,
      elements: codomain,
      points: relation.codomain,
      x: 3,
      color: COLORS.PURPLE,
    },
  ];
  return (
    <VisualCardScene aria-label={accessibilityLabel} render={<figure />}>
      <CoordinateSystem
        cameraPosition={[0, 3, 11]}
        cameraProjection={{ kind: "orthographic" }}
        cameraTarget={[0, 3, 0]}
        showOrigin={false}
      >
        {/* Keep every element on its arrow row, above the X axis. */}
        <group position={[0, 3, 0]}>
          {Arr.map(sets, (set) => (
            <group key={set.id}>
              <LineEquation
                color={set.color}
                points={Arr.map(ELLIPSE_POINTS, (point) => ({
                  ...point,
                  x: point.x + set.x,
                }))}
                showPoints={false}
                smooth={false}
              />
              <ThreeLabel
                anchorY="bottom"
                color={set.color}
                fontSize="diagram"
                gap={0.2}
                position={[set.x, 2.5, 0]}
              >
                {set.label}
              </ThreeLabel>
              {Arr.map(set.points, (point, index) => (
                <ThreeLabel
                  color={set.color}
                  fontSize="diagram"
                  key={point.id}
                  position={[point.x, point.y, point.z]}
                >
                  {set.elements[index].label}
                </ThreeLabel>
              ))}
            </group>
          ))}
          {Arr.map(relation.mappings, (mapping) => (
            <LineEquation
              color={COLORS.ORANGE}
              cone={{ position: "end", size: 0.25 }}
              key={mapping.id}
              points={mapping.points}
              showPoints={false}
              smooth={false}
            />
          ))}
        </group>
      </CoordinateSystem>
      <ul className="sr-only">
        {Arr.map(relation.mappings, (mapping) => (
          <li key={mapping.id}>
            {domain[mapping.domainIndex].label} →{" "}
            {codomain[mapping.codomainIndex].label}
          </li>
        ))}
      </ul>
    </VisualCardScene>
  );
}
