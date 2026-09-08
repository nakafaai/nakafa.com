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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { COLORS } from "@repo/design-system/lib/color";
import { Effect } from "effect";
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
      <Card className="content-auto-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CoordinateControls />
      </Card>
    </CoordinateProvider>
  );
}

interface Element {
  id: string;
  label: ReactNode;
}
interface RelationVisualizerProps {
  accessibilityLabel: string;
  codomain: Element[];
  codomainLabel: ReactNode;
  domain: Element[];
  domainLabel: ReactNode;
  mappings: RelationMapping[];
}

const ELLIPSE_POINTS = createCircleOutlinePoints(1).map((point) => ({
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
      domain: domain.map(({ id }) => id),
      codomain: codomain.map(({ id }) => id),
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
      color: COLORS.BLUE,
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
    <figure aria-label={accessibilityLabel}>
      <CoordinateSystem cameraPosition={[0, 0, 15]}>
        {sets.map((set) => (
          <group key={set.id}>
            <LineEquation
              color={set.color}
              points={ELLIPSE_POINTS.map((point) => ({
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
            {set.points.map((point, index) => (
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
        {relation.mappings.map((mapping) => (
          <LineEquation
            color={COLORS.BLUE}
            cone={{ position: "end", size: 0.25 }}
            key={mapping.id}
            points={mapping.points}
            showPoints={false}
            smooth={false}
          />
        ))}
      </CoordinateSystem>
      <ul className="sr-only">
        {relation.mappings.map((mapping) => (
          <li key={mapping.id}>
            {domain[mapping.domainIndex].label} →{" "}
            {codomain[mapping.codomainIndex].label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
