import { Line } from "@react-three/drei";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  type Panel,
  PanelSchema,
  panelPower,
} from "@repo/design-system/components/contents/physics/vector/solar/flux";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";

/** The height of the panel's centre above the grass, in metres. */
const CENTRE = 1.1;

/** The panel's long side, up its slope, and its short side, in metres. */
const SIZE = [1.7, 1] as const;

/** A point on the panel: a distance up its slope from the centre and across it, at a tilt in degrees. */
function onPanel(tilt: number, up: number, across: number, off = 0) {
  const turn = (tilt * Math.PI) / 180;
  return [
    -Math.cos(turn) * up + Math.sin(turn) * off,
    CENTRE + Math.sin(turn) * up + Math.cos(turn) * off,
    across,
  ] satisfies CoordinateTuple;
}

/** The panel of cells in its aluminium frame on two posts, its normal (teal) and the direction to the sun (amber), and sunlight arriving. */
function SolarScene({
  panel,
  tilt,
}: {
  readonly panel: Panel;
  readonly tilt: number;
}) {
  const turn = (tilt * Math.PI) / 180;
  const sun = (panel.elevation * Math.PI) / 180;
  const toward = [Math.cos(sun), Math.sin(sun), 0] as const;
  const normal = [Math.sin(turn), Math.cos(turn), 0] satisfies CoordinateTuple;
  const low = onPanel(tilt, -SIZE[0] / 2 + 0.1, 0, -0.05);
  const high = onPanel(tilt, SIZE[0] / 2 - 0.1, 0, -0.05);
  const centre = onPanel(tilt, 0, 0, 0.03);

  return (
    <group>
      <group position={[0, CENTRE, 0]} rotation={[0, 0, -turn]}>
        <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[SIZE[1], 0.04, SIZE[0]]} />
          <meshStandardMaterial
            color={MATERIAL.aluminium}
            metalness={0.8}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SIZE[0] - 0.06, SIZE[1] - 0.06]} />
          <meshStandardMaterial
            color={MATERIAL.solarCell}
            metalness={0.4}
            roughness={0.12}
          />
        </mesh>
        {Arr.makeBy(9, (index) => (
          <mesh
            key={index}
            position={[
              -SIZE[0] / 2 + 0.03 + (index + 1) * ((SIZE[0] - 0.06) / 10),
              0.0215,
              0,
            ]}
          >
            <boxGeometry args={[0.006, 0.001, SIZE[1] - 0.06]} />
            <meshStandardMaterial
              color={MATERIAL.chrome}
              metalness={1}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>
      {Arr.map([-0.42, 0.42], (z) => (
        <group key={z}>
          <Rod
            color={MATERIAL.aluminium}
            from={[low[0], 0, z]}
            metalness={0.8}
            radius={0.025}
            roughness={0.35}
            to={[low[0], low[1], z]}
          />
          <Rod
            color={MATERIAL.aluminium}
            from={[high[0], 0, z]}
            metalness={0.8}
            radius={0.025}
            roughness={0.35}
            to={[high[0], high[1], z]}
          />
        </group>
      ))}
      {Arr.map([-0.6, -0.2, 0.2, 0.6], (up) => {
        const hit = onPanel(tilt, up * 0.9, 0.25, 0.03);
        return (
          <Line
            color={MATERIAL.headlightGlow}
            key={up}
            lineWidth={1.5}
            opacity={0.8}
            points={[
              [hit[0] + toward[0] * 2.4, hit[1] + toward[1] * 2.4, hit[2]],
              hit,
            ]}
            transparent
          />
        );
      })}
      <FixedArrow
        color={PLOT_COLORS.teal}
        from={centre}
        head={0.1}
        thickness={0.014}
        vector={[normal[0] * 0.9, normal[1] * 0.9, 0]}
      />
      <FixedArrow
        color={PLOT_COLORS.amber}
        from={centre}
        head={0.1}
        thickness={0.014}
        vector={[toward[0] * 0.9, toward[1] * 0.9, 0]}
      />
      <ThreeLabel
        color={PLOT_COLORS.teal}
        fontSize="reading"
        position={[
          centre[0] + normal[0] * 1.08,
          centre[1] + normal[1] * 1.08,
          0,
        ]}
      >
        <InlineMath math="\hat n" />
      </ThreeLabel>
      <ThreeLabel
        color={PLOT_COLORS.amber}
        fontSize="reading"
        position={[
          centre[0] + toward[0] * 1.08,
          centre[1] + toward[1] * 1.08,
          0,
        ]}
      >
        <InlineMath math="\hat s" />
      </ThreeLabel>
    </group>
  );
}

interface SolarPanelFluxLabProps {
  /** The panel's area, in m². */
  area: number;
  description: ReactNode;
  /** The sun's elevation above the horizon, in degrees. */
  elevation: number;
  labels: {
    between: ReactNode;
    cosine: ReactNode;
    power: ReactNode;
    tilt: ReactNode;
    tiltName: string;
    viewLabel: string;
  };
  /** The sunlight arriving square on, in W/m². */
  sunlight: number;
  /** The tilt the card starts at, in degrees from level. */
  tilt: number;
  title: ReactNode;
}

/**
 * A solar panel on a frame in a field, with the sun in the sky it faces.
 * The learner tilts the panel: the power it catches is the dot product of
 * the sunlight and its area vector, I A cos θ, greatest when the normal
 * points straight at the sun.
 */
export function SolarPanelFluxLab({
  area,
  description,
  elevation,
  labels,
  sunlight,
  tilt: start,
  title,
}: SolarPanelFluxLabProps) {
  const quantity = useQuantity();
  const [tilt, setTilt] = useState(start);
  const panel = useMemo(
    () => Schema.decodeUnknownSync(PanelSchema)({ area, elevation, sunlight }),
    [area, elevation, sunlight]
  );
  const caught = panelPower(panel, tilt);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.tilt}
          max={90}
          min={0}
          name={labels.tiltName}
          onValueChange={setTilt}
          readout={<InlineMath math={quantity(tilt, "^\\circ", 0)} />}
          step={1}
          value={tilt}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.6, 1.6, 3.6]}
              cameraTarget={[0.3, 1.1, 0]}
              fov={38}
              maxDistance={7}
              minDistance={1.4}
            />
            <SolarScene panel={panel} tilt={tilt} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.between}
            value={<InlineMath math={quantity(caught.between, "^\\circ", 0)} />}
          />
          <VisualFactTabular
            label={labels.cosine}
            value={<InlineMath math={quantity(caught.cosine, "", 3)} />}
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath math={quantity(caught.power, "\\text{ W}", 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
