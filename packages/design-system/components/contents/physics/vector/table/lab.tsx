import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { Rod } from "@repo/design-system/components/contents/physics/vector/solid/rod";
import {
  type Pull,
  PullsSchema,
  pullForce,
  tableResultant,
} from "@repo/design-system/components/contents/physics/vector/table/force";
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

/** The height of the table top above the floor, in metres. */
const TOP = 0.82;

/** The radius of the table top, in metres. */
const RADIUS = 0.22;

/** Where the pulleys stand, just past the rim, in metres from the middle. */
const PULLEY = RADIUS + 0.018;

/** The height the strings run at, above the top, in metres. */
const STRING = TOP + 0.03;

/** Metres of arrow per newton of pull. */
const ARROW_SCALE = 0.036;

/** The mass of one slotted disc, in grams. */
const DISC = 50;

/** The colors of the pulls in order, and of their resultant. */
const PULL_COLORS = [
  PLOT_COLORS.teal,
  PLOT_COLORS.amber,
  PLOT_COLORS.fuchsia,
  PLOT_COLORS.pink,
] as const;

/** A value rounded to hundredths, with no negative zero. */
function rounded(value: number) {
  return Math.round(value * 100) / 100 + 0;
}

/** A point on the table at a radius and a rim angle, in scene metres. */
function onTable(radius: number, angle: number, height: number) {
  const turn = (angle * Math.PI) / 180;
  return [
    radius * Math.cos(turn),
    height,
    -radius * Math.sin(turn),
  ] satisfies CoordinateTuple;
}

/** The round top with its degree ring, the centre pin, and the tripod it stands on. */
function Table() {
  return (
    <group>
      <mesh castShadow position={[0, TOP - 0.006, 0]} receiveShadow>
        <cylinderGeometry args={[RADIUS, RADIUS, 0.012, 96]} />
        <meshStandardMaterial
          color={MATERIAL.epoxy}
          metalness={0.2}
          roughness={0.55}
        />
      </mesh>
      {Arr.makeBy(72, (index) => {
        const long = index % 6 === 0;
        const at = onTable(
          RADIUS - (long ? 0.016 : 0.01),
          index * 5,
          TOP + 0.0004
        );
        return (
          <mesh
            key={index}
            position={at}
            rotation={[0, (index * 5 * Math.PI) / 180, 0]}
          >
            <boxGeometry args={[long ? 0.026 : 0.014, 0.0008, 0.0016]} />
            <meshStandardMaterial color={MATERIAL.deckWhite} roughness={0.6} />
          </mesh>
        );
      })}
      <mesh castShadow position={[0, TOP + 0.012, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.024, 12]} />
        <meshStandardMaterial
          color={MATERIAL.chrome}
          metalness={1}
          roughness={0.2}
        />
      </mesh>
      <mesh castShadow position={[0, TOP / 2, 0]}>
        <cylinderGeometry args={[0.016, 0.02, TOP, 20]} />
        <meshStandardMaterial
          color={MATERIAL.castIron}
          metalness={0.6}
          roughness={0.45}
        />
      </mesh>
      {Arr.map([90, 210, 330], (angle) => (
        <Rod
          color={MATERIAL.castIron}
          from={onTable(0.02, angle, 0.12)}
          key={angle}
          metalness={0.6}
          radius={0.012}
          roughness={0.45}
          to={onTable(0.26, angle, 0.01)}
        />
      ))}
    </group>
  );
}

/** One pulley on the rim, its string from the ring, and the hanger of slotted discs below it. */
function Pulley({ pull, ring }: { pull: Pull; ring: CoordinateTuple }) {
  const top = onTable(PULLEY, pull.angle, STRING);
  const hook = onTable(PULLEY + 0.012, pull.angle, TOP - 0.3);
  const discs = Math.max(1, Math.round(pull.mass / DISC));
  const turn = (pull.angle * Math.PI) / 180;

  return (
    <group>
      <Rod color={MATERIAL.cotton} from={ring} radius={0.0007} to={top} />
      <Rod
        color={MATERIAL.cotton}
        from={onTable(PULLEY + 0.012, pull.angle, STRING - 0.012)}
        radius={0.0007}
        to={hook}
      />
      <group
        position={onTable(PULLEY, pull.angle, STRING - 0.012)}
        rotation={[0, turn, 0]}
      >
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.013, 0.013, 0.005, 28]} />
          <meshStandardMaterial
            color={MATERIAL.brass}
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
      </group>
      <mesh
        castShadow
        position={onTable(RADIUS - 0.004, pull.angle, TOP - 0.02)}
      >
        <boxGeometry args={[0.022, 0.03, 0.022]} />
        <meshStandardMaterial
          color={MATERIAL.castIron}
          metalness={0.5}
          roughness={0.45}
        />
      </mesh>
      {Arr.makeBy(discs, (index) => (
        <mesh
          castShadow
          key={index}
          position={[hook[0], hook[1] - 0.012 - index * 0.0085, hook[2]]}
        >
          <cylinderGeometry args={[0.019, 0.019, 0.0075, 28]} />
          <meshStandardMaterial
            color={MATERIAL.brass}
            metalness={0.8}
            roughness={0.35}
          />
        </mesh>
      ))}
    </group>
  );
}

/** The table with its strings, the ring they pull, and each pull and the resultant drawn above it. */
function TableScene({
  pulls,
}: {
  pulls: readonly (Pull & { readonly slot: number })[];
}) {
  const resultant = tableResultant(pulls);
  const nudge = Math.min(0.006, resultant.size * 0.003);
  const ring = onTable(nudge, resultant.angle, STRING);
  const arrowHeight = STRING + 0.05;

  return (
    <group>
      <Table />
      <mesh position={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.008, 0.0016, 12, 32]} />
        <meshStandardMaterial
          color={MATERIAL.chrome}
          metalness={1}
          roughness={0.2}
        />
      </mesh>
      {Arr.map(pulls, (pull) => {
        const force = pullForce(pull);
        const color = PULL_COLORS[pull.slot % PULL_COLORS.length];
        const tip = onTable(force.size * ARROW_SCALE, pull.angle, 0);
        return (
          <group key={pull.slot}>
            <Pulley pull={pull} ring={ring} />
            <FixedArrow
              color={color}
              from={[0, arrowHeight, 0]}
              head={0.022}
              thickness={0.0032}
              vector={tip}
            />
            <ThreeLabel
              color={color}
              fontSize="reading"
              position={onTable(
                force.size * ARROW_SCALE + 0.03,
                pull.angle,
                arrowHeight
              )}
            >
              <InlineMath math={`\\vec F_{${pull.slot + 1}}`} />
            </ThreeLabel>
          </group>
        );
      })}
      <FixedArrow
        color={PLOT_COLORS.violet}
        from={[0, arrowHeight + 0.004, 0]}
        head={0.026}
        thickness={0.0042}
        vector={onTable(resultant.size * ARROW_SCALE, resultant.angle, 0)}
      />
      <ThreeLabel
        color={PLOT_COLORS.violet}
        fontSize="reading"
        position={onTable(
          resultant.size * ARROW_SCALE + 0.03,
          resultant.angle,
          arrowHeight
        )}
      >
        <InlineMath math="\vec R" />
      </ThreeLabel>
    </group>
  );
}

interface ForceTableResultantLabProps {
  description: ReactNode;
  labels: {
    angle: ReactNode;
    angleName: string;
    direction: ReactNode;
    resultant: ReactNode;
    sumX: ReactNode;
    sumY: ReactNode;
    viewLabel: string;
  };
  /** The strings: hanging mass in grams and pulley angle in degrees; the learner turns the last one. */
  pulls: readonly Pull[];
  title: ReactNode;
}

/**
 * A force table on a lab bench. Every string pulls the ring with the weight
 * of its hanging discs, toward its pulley. The learner turns the last
 * pulley around the rim; the pulls add by components into the resultant
 * (violet), which pulls the ring off the centre pin until a string balances
 * it.
 */
export function ForceTableResultantLab({
  description,
  labels,
  pulls: initial,
  title,
}: ForceTableResultantLabProps) {
  const quantity = useQuantity();
  const setup = useMemo(
    () => Schema.decodeUnknownSync(PullsSchema)(initial),
    [initial]
  );
  const last = setup.length - 1;
  const [angle, setAngle] = useState(setup[last]?.angle ?? 0);
  const pulls = Arr.map(setup, (pull, slot) =>
    slot === last ? { ...pull, angle, slot } : { ...pull, slot }
  );
  const resultant = tableResultant(pulls);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.angle}
          max={360}
          min={0}
          name={labels.angleName}
          onValueChange={setAngle}
          readout={<InlineMath math={quantity(angle, "^\\circ", 0)} />}
          step={1}
          value={angle}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.7} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.12, 1.42, 0.62]}
              cameraTarget={[0, TOP - 0.04, 0]}
              fov={36}
              maxDistance={1.8}
              minDistance={0.35}
            />
            <TableScene pulls={pulls} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.sumX}
            value={
              <InlineMath
                math={quantity(rounded(resultant.x), "\\text{ N}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.sumY}
            value={
              <InlineMath
                math={quantity(rounded(resultant.y), "\\text{ N}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.resultant}
            value={
              <InlineMath
                math={quantity(rounded(resultant.size), "\\text{ N}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.direction}
            value={
              <InlineMath math={quantity(resultant.angle, "^\\circ", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
