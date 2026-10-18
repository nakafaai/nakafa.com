"use client";

import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
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
  VisualCard,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactIndicator } from "@repo/design-system/components/visual/fact";
import { COLORS } from "@repo/design-system/lib/color";
import { Array as Arr, Effect } from "effect";
import { useFormatter } from "next-intl";
import type { ReactNode } from "react";

interface Props {
  description: ReactNode;
  title: ReactNode;
  /** Each vector's geometry, with its name and an optional color. */
  vectors: (typeof VectorGeometrySchema.Type & {
    color?: string;
    id: string;
    name: ReactNode;
  })[];
}

const VECTOR_COLORS = [COLORS.ORANGE, COLORS.PURPLE, COLORS.AMBER];
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

/** A vector's color: its own when the lesson gives one, otherwise the next color of the scene. */
function vectorColor(vector: Props["vectors"][number], index: number) {
  return vector.color ?? VECTOR_COLORS[index % VECTOR_COLORS.length];
}

/**
 * One reading for each vector in the footer: its name, marked with its color,
 * and its components, which run from its tail to its tip.
 */
function VectorFacts({ vectors }: Pick<Props, "vectors">) {
  const format = useFormatter();
  const formatNumber = (value: number) =>
    mathNumber(format.number(value, MATH_NUMBER_OPTIONS));

  return (
    <VisualCardFacts>
      {Arr.map(vectors, (vector, index) => {
        const { tail, tip } = Effect.runSync(resolveVectorGeometry(vector));
        const components = `(${formatNumber(tip.x - tail.x)}, ${formatNumber(tip.y - tail.y)})`;
        return (
          <VisualFactIndicator
            indicatorColor={vectorColor(vector, index)}
            key={vector.id}
            label={vector.name}
            value={<InlineMath math={components} />}
          />
        );
      })}
    </VisualCardFacts>
  );
}

/** Preserves authored point order and arrow direction in the shared plane scene. */
export function VectorChart({ title, description, vectors }: Props) {
  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <CoordinateSystem
          cameraFraming="content"
          cameraPosition={[0, 0, 15]}
          cameraProjection={{ kind: "orthographic" }}
          showOrigin={false}
          showZAxis={false}
        >
          {Arr.map(vectors, (vector, index) => {
            const geometry = Effect.runSync(resolveVectorGeometry(vector));
            const arrow = VECTOR_ARROWS[geometry.direction];
            const color = vectorColor(vector, index);
            const { tail, tip } = geometry;
            const horizontal = tip.x - tail.x;
            const horizontalAnchor = horizontal > 0 ? "left" : "right";
            const verticalAnchor = tip.y >= 0 ? "bottom" : "top";
            return (
              <group key={vector.id}>
                <LineEquation
                  color={color}
                  cone={arrow ? { position: arrow } : undefined}
                  points={Arr.map(geometry.points, (point) => ({
                    ...point,
                    z: 0,
                  }))}
                  showPoints={Arr.every(
                    geometry.points,
                    (point) => point.x === tip.x && point.y === tip.y
                  )}
                  smooth={false}
                />
                <ThreeLabel
                  anchorX={horizontal === 0 ? "center" : horizontalAnchor}
                  anchorY={verticalAnchor}
                  color={color}
                  fontSize="diagram"
                  gap={0.75}
                  position={[tip.x, tip.y, 0]}
                >
                  {vector.name}
                </ThreeLabel>
              </group>
            );
          })}
        </CoordinateSystem>
        <div className="sr-only">
          {Arr.map(vectors, (vector) => (
            <p key={vector.id}>
              {vector.name}:{" "}
              <InlineMath
                math={Arr.join(
                  Arr.map(vector.points, ({ x, y }) => `(${x}, ${y})`),
                  ` ${VECTOR_NOTATION[vector.direction ?? "forward"]} `
                )}
              />
            </p>
          ))}
        </div>
        <CoordinateControls />
        <VisualCardFooter>
          <VectorFacts vectors={vectors} />
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}
