"use client";

import {
  resolveVectorGeometry,
  type VectorGeometrySchema,
} from "@repo/design-system/components/contents/mathematics/vector";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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

type Vector = typeof VectorGeometrySchema.Type & {
  color?: string;
  id: string;
  name: ReactNode;
};

interface Props {
  description: ReactNode;
  title: ReactNode;
  vectors: Vector[];
}

const VECTOR_COLORS = [COLORS.BLUE, COLORS.PURPLE, COLORS.AMBER];
const VECTOR_ARROWS = {
  forward: "end",
  backward: "start",
  both: "both",
  none: undefined,
} as const;
const VECTOR_NOTATION = {
  forward: "\\longrightarrow",
  backward: "\\longleftarrow",
  both: "\\longleftrightarrow",
  none: "\\mathbin{-}",
};

/** Preserves authored point order and arrow direction in the shared plane scene. */
export function VectorChart({ title, description, vectors }: Props) {
  return (
    <CoordinateProvider>
      <Card className="content-auto-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <CoordinateSystem cameraPosition={[0, 0, 15]}>
            {vectors.map((vector, index) => {
              const geometry = Effect.runSync(resolveVectorGeometry(vector));
              const arrow = VECTOR_ARROWS[geometry.direction];
              const color =
                vector.color ?? VECTOR_COLORS[index % VECTOR_COLORS.length];
              const { tail, tip } = geometry;
              const horizontal = tip.x - tail.x;
              const vertical = tip.y - tail.y;
              const horizontalAnchor = horizontal > 0 ? "left" : "right";
              const verticalAnchor = vertical >= 0 ? "bottom" : "top";
              return (
                <group key={vector.id}>
                  <LineEquation
                    color={color}
                    cone={arrow ? { position: arrow } : undefined}
                    points={geometry.points.map((point) => ({
                      ...point,
                      z: 0,
                    }))}
                    smooth={false}
                  />
                  <ThreeLabel
                    anchorX={horizontal === 0 ? "center" : horizontalAnchor}
                    anchorY={horizontal === 0 ? verticalAnchor : "middle"}
                    color={color}
                    fontSize="diagram"
                    gap={0.2}
                    position={[tip.x, tip.y, 0]}
                  >
                    {vector.name}
                  </ThreeLabel>
                </group>
              );
            })}
          </CoordinateSystem>
          <div className="sr-only">
            {vectors.map((vector) => (
              <p key={vector.id}>
                {vector.name}:{" "}
                <InlineMath
                  math={vector.points
                    .map(({ x, y }) => `(${x}, ${y})`)
                    .join(
                      ` ${VECTOR_NOTATION[vector.direction ?? "forward"]} `
                    )}
                />
              </p>
            ))}
          </div>
        </CardContent>
        <CoordinateControls />
      </Card>
    </CoordinateProvider>
  );
}
