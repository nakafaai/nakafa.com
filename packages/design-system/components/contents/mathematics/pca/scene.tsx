import { Line } from "@react-three/drei";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import type { PcaSubspace } from "@repo/design-system/components/contents/mathematics/pca/model";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { Facets } from "@repo/design-system/components/three/facets";
import { GraphMarker } from "@repo/design-system/components/three/marker";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { STROKE_DASH } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";

/**
 * The centered sample, in its own principal coordinates: the first along PC1,
 * the second along PC3 and the third along PC2.
 */
const SAMPLES = [
  [-2.2, -0.75, -0.65],
  [-1.65, 0.52, -0.45],
  [-1.1, -0.42, 0.55],
  [-0.55, 0.78, -0.32],
  [0.35, -0.64, 0.58],
  [0.95, 0.58, -0.38],
  [1.55, -0.48, 0.44],
  [2.15, 0.72, 0.62],
] as const;
/** The patch of the plane PC1 and PC2 span that the lab shades. */
const PLANE = [
  [
    { x: -2.6, y: 0, z: -1.5 },
    { x: 2.6, y: 0, z: -1.5 },
    { x: 2.6, y: 0, z: 1.5 },
    { x: -2.6, y: 0, z: 1.5 },
  ],
] as const;
/**
 * How the principal frame stands in the world. The principal axes of a data
 * set are a turned frame, so they never hide under the X, Y and Z axes.
 */
const FRAME_TURN = [0.3, 0.52, 0.2] as const;

export function PcaProjection3DScene({
  correlation,
  parts,
  subspace,
  sweep,
}: {
  readonly correlation: number;
  readonly parts: Readonly<
    Record<
      | "pc1Axis"
      | "pc2Axis"
      | "pc3Axis"
      | "pointCloud"
      | "projectionPlane"
      | "residualLines",
      string
    >
  >;
  readonly subspace: PcaSubspace;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
}) {
  const colors = useCalculusColors();
  // A stronger correlation gathers the cloud onto its first axis.
  const spread = 1.25 - correlation * 0.85;
  const points = Arr.map(SAMPLES, ([along, up, across]) => ({
    across: across * spread,
    along,
    up: up * spread,
  }));
  const first = Arr.headNonEmpty(
    Arr.appendAll(points, [{ across: 0, along: 0, up: 0 }])
  );
  const last = Arr.lastNonEmpty(
    Arr.prepend(points, { across: 0, along: 0, up: 0 })
  );

  return (
    <group rotation={FRAME_TURN}>
      <ParameterSweep {...sweep} value={correlation} />
      {subspace === "pc1Pc2Plane" ? (
        <Facets
          color={colors.plane}
          edgeWidth={1.4}
          faces={PLANE}
          opacity={0.16}
        />
      ) : null}
      <ArrowHelper
        arrowSize={0.24}
        color={colors.normal}
        from={[-2.7, 0, 0]}
        lineWidth={3.4}
        to={[2.9, 0, 0]}
      />
      <ArrowHelper
        arrowSize={0.22}
        color={colors.slope}
        from={[0, 0, -1.6]}
        lineWidth={subspace === "pc1Line" ? 1.8 : 3}
        to={[0, 0, 1.9]}
      />
      <ArrowHelper
        arrowSize={0.2}
        color={colors.cut}
        from={[0, -1.2, 0]}
        lineWidth={subspace === "full3D" ? 3 : 1.8}
        to={[0, 1.5, 0]}
      />
      {Arr.map(points, ({ across, along, up }) => {
        const foot = subspace === "pc1Line" ? 0 : across;
        return (
          <group key={along}>
            {subspace === "full3D" ? null : (
              <>
                <Line
                  color={colors.alert}
                  dashed
                  dashSize={STROKE_DASH.dash / 2}
                  gapSize={STROKE_DASH.gap / 2}
                  lineWidth={1.8}
                  points={[
                    [along, up, across],
                    [along, 0, foot],
                  ]}
                />
                <GraphMarker
                  color={colors.accent}
                  position={[along, 0, foot]}
                  radius={0.055}
                />
              </>
            )}
            <GraphMarker
              color={colors.curve}
              position={[along, up, across]}
              radius={0.08}
            />
          </group>
        );
      })}
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.normal}
        gap={0.1}
        math="\mathrm{PC}_1"
        name={parts.pc1Axis}
        position={[2.9, 0, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.slope}
        gap={0.1}
        math="\mathrm{PC}_2"
        name={parts.pc2Axis}
        position={[0, 0, 1.9]}
      />
      <GraphTag
        anchorX="left"
        anchorY="bottom"
        color={colors.cut}
        gap={0.1}
        math="\mathrm{PC}_3"
        name={parts.pc3Axis}
        position={[0, 1.5, 0]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.curve}
        gap={0.14}
        math="\vec{x}_i"
        name={parts.pointCloud}
        position={[first.along, first.up, first.across]}
      />
      {subspace === "pc1Pc2Plane" ? (
        <GraphTag
          anchorX="right"
          anchorY="top"
          color={colors.plane}
          gap={0.1}
          math="\operatorname{span}(\mathrm{PC}_1, \mathrm{PC}_2)"
          name={parts.projectionPlane}
          position={[-2.6, 0, 1.5]}
        />
      ) : null}
      {subspace === "full3D" ? null : (
        <GraphTag
          anchorX="left"
          anchorY="middle"
          color={colors.alert}
          gap={0.12}
          math="\vec{x}_i - \hat{x}_i"
          name={parts.residualLines}
          position={[
            last.along,
            last.up / 2,
            subspace === "pc1Line" ? last.across / 2 : last.across,
          ]}
        />
      )}
    </group>
  );
}
