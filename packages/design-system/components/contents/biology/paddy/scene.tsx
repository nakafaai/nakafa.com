import { useReducedMotion } from "@mantine/hooks";
import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { PaddyContext } from "@repo/design-system/components/contents/biology/paddy/context";
import type { Hill } from "@repo/design-system/components/contents/biology/paddy/field";
import {
  cropHills,
  hillMatrix,
  rootedHills,
} from "@repo/design-system/components/contents/biology/paddy/field";
import { RootFlow } from "@repo/design-system/components/contents/biology/paddy/flow";
import { SECTION_DEPTH } from "@repo/design-system/components/contents/biology/paddy/gases";
import { SoilGrains } from "@repo/design-system/components/contents/biology/paddy/grains";
import { SLICE } from "@repo/design-system/components/contents/biology/paddy/lens";
import type {
  Plant,
  Water,
} from "@repo/design-system/components/contents/biology/paddy/oxygen";
import {
  useLeafMaterial,
  useShoot,
} from "@repo/design-system/components/contents/biology/paddy/plant";
import {
  OxygenStrip,
  STAKE,
  Stake,
} from "@repo/design-system/components/contents/biology/paddy/probe";
import {
  RootSystem,
  rootPaths,
} from "@repo/design-system/components/contents/biology/paddy/roots";
import { RootSection } from "@repo/design-system/components/contents/biology/paddy/section";
import {
  MudSurface,
  SoilVolume,
} from "@repo/design-system/components/contents/biology/paddy/soil";
import {
  WATER_DEPTH,
  WaterSurface,
} from "@repo/design-system/components/contents/biology/paddy/water";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr, Option, Order } from "effect";
import type { ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import { MeshBasicMaterial, Quaternion, Vector3 } from "three";

/**
 * Where the lens hovers, and its radius, in metres: over the water right of
 * the plants on a wide card, above the crop on a narrow one.
 */
const INSET = {
  narrow: [0.2, 0.5, 0.6],
  radius: 0.15,
  wide: [0.62, 0.24, 0.5],
} as const;

/** The camera's first view: from the bank, a little above the crop, looking down into the field. */
const VIEW = {
  position: [0.42, 0.8, 1.95],
  target: [0, -0.03, -0.05],
} as const;

/**
 * Eases the flood toward the field's water state, a second or so either
 * way, waking the canvas while it moves; with reduced motion it jumps.
 */
function FloodEase({
  flood,
  water,
}: {
  readonly flood: RefObject<number>;
  readonly water: Water;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const reduced = useReducedMotion();
  const target = water === "flooded" ? 1 : 0;

  useEffect(() => {
    if (reduced) {
      flood.current = target;
    }
    invalidate();
  }, [flood, invalidate, reduced, target]);

  useFrame((_, delta) => {
    const gap = target - flood.current;
    if (Math.abs(gap) < 0.002) {
      flood.current = target;
      return;
    }
    flood.current += gap * Math.min(1, simulationStep(delta) * 3.2);
    invalidate();
  });

  return null;
}

/**
 * The crop as far as the haze: the plants over the X-ray zone in full
 * detail, the next few metres plainer, and the rest plainest.
 */
function Crop({ plant }: { readonly plant: Plant }) {
  const shoots = {
    distant: useShoot(plant, "distant"),
    far: useShoot(plant, "far"),
    near: useShoot(plant, "near"),
  };
  const material = useLeafMaterial();
  const groups = useMemo(() => {
    const placements = Arr.map(cropHills(plant), (hill) => ({
      detail: hill.detail,
      position: [hill.x, 0, hill.z] as const,
      rotation: [0, hill.yaw, 0] as const,
      scale: [1, hill.height, 1] as const,
    }));
    return Arr.map(["near", "far", "distant"] as const, (detail) => ({
      detail,
      placements: Arr.filter(placements, (each) => each.detail === detail),
    }));
  }, [plant]);

  return (
    <>
      {Arr.map(groups, ({ detail, placements }) => (
        <Instances key={detail} placements={placements}>
          <primitive attach="geometry" object={shoots[detail]} />
          <primitive attach="material" object={material} />
        </Instances>
      ))}
    </>
  );
}

/** How near a point on the surface lies to the lens at `lens`: the nearer, the larger. */
function nearLens(lens: Vector3, x: number, z: number) {
  return -Math.hypot(x - lens.x, z - lens.z);
}

/**
 * The point the lens looks at: on the root of the plant nearest the lens that
 * heads most toward it, partway down.
 */
function slicePoint(plant: Plant, lens: Vector3) {
  const hills = rootedHills(plant);
  const hill = Option.getOrElse(
    Arr.head(
      Arr.sort(
        hills,
        Order.mapInput(
          Order.Number,
          (each: Hill) => -nearLens(lens, each.x, each.z)
        )
      )
    ),
    (): Hill => ({
      detail: "near",
      height: 1,
      rooted: true,
      x: 0,
      yaw: 0,
      z: 0,
    })
  );
  const place = hillMatrix(hill);
  const points = Arr.map(
    Arr.filter(rootPaths(plant), (path) => !path.shallow),
    (path) => {
      const deep = Option.getOrElse(
        Arr.findFirst(path.points, (point) => -point.y >= SECTION_DEPTH * 0.8),
        () => Option.getOrElse(Arr.last(path.points), () => new Vector3())
      );
      return deep.clone().applyMatrix4(place);
    }
  );
  return Option.getOrElse(
    Arr.head(
      Arr.sort(
        points,
        Order.mapInput(
          Order.Number,
          (point: Vector3) => -nearLens(lens, point.x, point.z)
        )
      )
    ),
    () => new Vector3()
  );
}

/**
 * The lens over the water beside the plants, turned toward the first view,
 * tied by two sight lines to a ring round the root it magnifies in the mud,
 * with the label of rice's air channels and the key to the particles that
 * move in it, which come as `children`.
 */
function Inset({
  children,
  label,
  plant,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly plant: Plant;
}) {
  const ink = useLabelInk();
  const narrow = useNarrow();
  const centre = useMemo(
    () => new Vector3(...(narrow ? INSET.narrow : INSET.wide)),
    [narrow]
  );
  const anchor = useMemo(() => slicePoint(plant, centre), [centre, plant]);
  const turn = useMemo(() => {
    const facing = new Vector3(...VIEW.position).sub(centre).normalize();
    return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), facing);
  }, [centre]);
  const marker = useMemo(
    () =>
      new MeshBasicMaterial({
        color: ink,
        depthTest: false,
        opacity: 0.85,
        toneMapped: false,
        transparent: true,
      }),
    [ink]
  );
  useEffect(() => () => marker.dispose(), [marker]);
  const rim = useMemo(() => {
    const toward = anchor.clone().sub(centre).normalize();
    const across = new Vector3(0, 0, 1)
      .applyQuaternion(turn)
      .cross(toward)
      .normalize();
    return Arr.map([-1, 1] as const, (hand) =>
      centre.clone().addScaledVector(across, hand * INSET.radius)
    );
  }, [anchor, centre, turn]);

  return (
    <>
      {Arr.map(rim, (point) => (
        <Line
          color={ink}
          depthTest={false}
          key={`${point.x}-${point.y}`}
          lineWidth={1}
          opacity={0.6}
          points={[anchor.toArray(), point.toArray()]}
          renderOrder={10}
          transparent
        />
      ))}
      <mesh position={anchor} quaternion={turn} renderOrder={10}>
        <ringGeometry args={[0.009, 0.0108, 40]} />
        <primitive attach="material" object={marker} />
      </mesh>
      <group position={centre} quaternion={turn} scale={INSET.radius}>
        <RootSection />
        {children}
        {plant === "rice" && (
          <>
            <Line
              color={ink}
              lineWidth={1}
              opacity={0.7}
              points={[
                [0.08, 0.5, SLICE / 2 + 0.02],
                [0.3, 1.18, SLICE / 2 + 0.02],
              ]}
              transparent
            />
            <ThreeLabel
              anchorY="bottom"
              color={ink}
              fontSize="compact"
              maximumFontSize={16}
              position={[0.3, 1.2, SLICE / 2]}
            >
              {label}
            </ThreeLabel>
          </>
        )}
        <ThreeLabel
          anchorY="top"
          color={ink}
          fontSize="compact"
          maximumFontSize={16}
          position={[0, -1.12, SLICE / 2]}
        >
          <span
            style={{
              alignItems: "center",
              display: "inline-flex",
              gap: "0.6em",
            }}
          >
            <Swatch color={PADDY_COLORS.oxygen} formula="\mathrm{O_2}" />
            <Swatch
              color={PADDY_COLORS.carbonDioxide}
              formula="\mathrm{CO_2}"
            />
            <Swatch color={PADDY_COLORS.ethanol} formula="\mathrm{C_2H_5OH}" />
          </span>
        </ThreeLabel>
      </group>
    </>
  );
}

/** One entry of the particle key: a dot in the particle's colour and its formula. */
function Swatch({
  color,
  formula,
}: {
  readonly color: string;
  readonly formula: string;
}) {
  return (
    <span
      style={{ alignItems: "center", display: "inline-flex", gap: "0.25em" }}
    >
      <span
        style={{
          background: color,
          borderRadius: "50%",
          boxShadow: `0 0 0 1px ${PADDY_COLORS.swatchEdge}`,
          display: "inline-block",
          height: "0.6em",
          width: "0.6em",
        }}
      />
      <InlineMath math={formula} />
    </span>
  );
}

/** Whether the card is narrow, as on a phone: no wider than a little over its height. */
function useNarrow() {
  const size = useThree((state) => state.size);
  return size.width < size.height * 1.2;
}

/** Looks into the field from the bank, a little above the crop; farther back on a narrow card. */
function PaddyCamera() {
  const back = useNarrow() ? 1.12 : 1;
  const [x, y, z] = VIEW.position;
  const [tx, ty, tz] = VIEW.target;
  return (
    <CameraControls
      cameraPosition={[
        tx + (x - tx) * back,
        ty + (y - ty) * back,
        tz + (z - tz) * back,
      ]}
      cameraTarget={VIEW.target}
      fov={36}
      maxAzimuthAngle={0.75}
      maxDistance={3}
      maxPolarAngle={1.3}
      minAzimuthAngle={-0.75}
      minDistance={0.5}
      minPolarAngle={0.8}
    />
  );
}

/**
 * A paddy field at real size, as far as the haze every way, with its soil
 * seen in X-ray view: floodwater over grey mud, a crop of rice or a dryland
 * crop, the roots of the nearest plants in the mud beside a measuring stake
 * and an oxygen strip, and a lens on one root, whose moving particles come
 * as `children`. The field floods and drains with `water`, and the particles
 * move while the card plays.
 */
export function PaddyScene({
  children,
  labels,
  plant,
  water,
}: {
  readonly children: ReactNode;
  readonly labels: {
    readonly aerenchyma: string;
    readonly mud: string;
    readonly root: string;
    readonly water: string;
  };
  readonly plant: Plant;
  readonly water: Water;
}) {
  const ink = useLabelInk();
  const playing = useVisualScene((card) => card.playing, false);
  const flood = useRef(water === "flooded" ? 1 : 0);
  const clock = useRef(2.4);
  const shared = useMemo(() => ({ clock, flood, plant }), [plant]);

  useFrame((_, delta) => {
    if (playing) {
      clock.current += simulationStep(delta);
    }
  });

  return (
    <PaddyContext value={shared}>
      <SimulationTicker running={playing} />
      <FloodEase flood={flood} water={water} />
      <PaddyCamera />
      <SoilVolume flood={flood} />
      <SoilGrains flood={flood} />
      <MudSurface flood={flood} />
      <WaterSurface flood={flood} />
      <Crop plant={plant} />
      <RootSystem flood={flood} plant={plant} />
      <RootFlow clock={clock} flood={flood} plant={plant} />
      <Stake />
      <OxygenStrip flood={flood} />
      <Inset label={labels.aerenchyma} plant={plant}>
        {children}
      </Inset>
      {water === "flooded" && (
        <ThreeLabel
          anchorX="left"
          color={ink}
          fontSize="compact"
          maximumFontSize={16}
          position={[STAKE.x + 0.04, WATER_DEPTH * 0.6, STAKE.z]}
        >
          {labels.water}
        </ThreeLabel>
      )}
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        maximumFontSize={16}
        position={[STAKE.x + 0.04, -0.07, STAKE.z]}
      >
        {labels.mud}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        maximumFontSize={16}
        position={[0, -0.21, 0.3]}
      >
        {labels.root}
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        maximumFontSize={16}
        position={[STAKE.x - 0.012, STAKE.top - 0.02, STAKE.z]}
      >
        <InlineMath math="\mathrm{O_2}" />
      </ThreeLabel>
    </PaddyContext>
  );
}
