import { RoundedBox } from "@react-three/drei";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Helm } from "@repo/design-system/components/three/vehicle/helm";
import {
  breadthAt,
  lidSheet,
} from "@repo/design-system/components/three/vehicle/lines";
import {
  heaveAt,
  rollAt,
  trimAt,
} from "@repo/design-system/components/three/vehicle/motion";
import { Outboard } from "@repo/design-system/components/three/vehicle/outboard";
import type { WakeRig } from "@repo/design-system/components/three/vehicle/wake";
import { Wake } from "@repo/design-system/components/three/vehicle/wake";
import type { HullLines } from "@repo/design-system/components/three/vessel/hull";
import {
  deckEdge,
  hullGeometry,
} from "@repo/design-system/components/three/vessel/hull";
import { Strake } from "@repo/design-system/components/three/vessel/strake";
import { BOAT_COLORS } from "@repo/design-system/lib/material/boat";
import { Array as Arr } from "effect";
import type { ReactNode, Ref } from "react";
import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeGeometry,
} from "three";

/**
 * An open outboard skiff at real size, in metres, facing +x with its origin
 * on the keel amidships: 4.3 m long, 1.62 m in beam and 0.62 m deep, drawing
 * 0.2 m, as a river ferryman's or a fisherman's boat measures.
 */
const SKIFF = {
  beam: 1.62,
  depth: 0.62,
  draught: 0.2,
  length: 4.3,
} as const;

/** The thickness of the hull's skin, in metres. */
const SKIN = 0.03;

/** How much the gunwale rises toward the bow, as a share of the depth. */
const SHEER = 0.24;

/** The lines of the hull's outside: a fine, raked bow and a broad transom. */
const LINES: HullLines = {
  beam: SKIFF.beam,
  bow: 0.56,
  depth: SKIFF.depth,
  forefoot: 0.32,
  length: SKIFF.length,
  rake: 0.5,
  run: 0.1,
  sheer: SHEER,
  square: 3.4,
  transom: 0.86,
};

/** The lines of the hull's inside: the outside, one skin smaller, to the same gunwale. */
const INSIDE: HullLines = {
  ...LINES,
  beam: LINES.beam - 2 * SKIN,
  depth: LINES.depth - SKIN,
  length: LINES.length - 2 * SKIN,
  sheer: (LINES.depth * SHEER) / (LINES.depth - SKIN),
};

/** The gunwale's height at the bow, just under which the open shell ends. */
const RIM = LINES.depth * (1 + SHEER) - 0.0005;

/**
 * The height above the keel at which the hull's inside is closed against
 * the water outside it: under the gunwale, over everything aboard that sits
 * below it.
 */
const LID = LINES.depth - SKIN - 0.07;

/** The height of the floorboards above the keel. */
const FLOOR = 0.11;

/** The height of the thwarts' tops above the keel. */
const SEAT = 0.37;

/** Where the three thwarts cross the hull, from the stern. */
const THWARTS = [-1.5, -0.15, 1.05] as const;

/** A coil of mooring line on the foredeck boards: a flat spiral, six turns. */
const COIL = Arr.makeBy(73, (index) => {
  const turn = (index / 12) * Math.PI * 2;
  const radius = 0.06 + index * 0.0016;
  return [
    1.55 + Math.cos(turn) * radius,
    FLOOR + 0.035 + index * 0.0004,
    Math.sin(turn) * radius,
  ] as const;
});

/** The fuel line from the tank to the engine, lying on the boards. */
const FUEL_LINE = [
  [-1.0, FLOOR + 0.2, -0.3],
  [-1.25, FLOOR + 0.05, -0.36],
  [-1.7, FLOOR + 0.03, -0.3],
  [-2.0, FLOOR + 0.2, -0.12],
  [-2.14, 0.6, -0.05],
] as const;

/** What a simulation drives on the skiff every frame. */
export interface SkiffRig {
  /**
   * Puts the boat at a place on the water, heading `yaw` radians about the
   * vertical from +x, moving through the water at `speed` m/s, at the
   * water's time `time` in seconds: the bow lifts with the speed, the hull
   * rides the ripples, the propeller turns and the wake follows.
   */
  readonly drive: (
    x: number,
    z: number,
    yaw: number,
    speed: number,
    time: number
  ) => void;
}

/** The floorboards: planks cut to the hull's inside at their height. */
function Boards() {
  const geometry = useMemo(() => {
    const stations = Arr.makeBy(33, (index) => -2.05 + (index / 32) * 3.75);
    const edge = Arr.map(
      stations,
      (x) => [x, breadthAt(INSIDE, x, FLOOR - SKIN) * 0.97] as const
    );
    const outline = new Shape();
    outline.moveTo(-2.05, -(edge[0]?.[1] ?? 0));
    Arr.forEach(edge, ([x, half]) => outline.lineTo(x, half));
    Arr.forEach(Arr.reverse(edge), ([x, half]) => outline.lineTo(x, -half));
    return new ShapeGeometry(outline);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[0, FLOOR, 0]}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <SurfaceMaterial
        color={BOAT_COLORS.thwart}
        repeat={[0.9, 0.9]}
        roughness={0.7}
        surface="planks"
      />
    </mesh>
  );
}

/**
 * The hull: antifouled below the waterline, with its lighter inside, and
 * above the waterline whatever paint the boat's owner gives its topsides.
 */
function Shell({ children }: { readonly children: ReactNode }) {
  const parts = useMemo(() => {
    const sheet = lidSheet(INSIDE, LID, 28);
    const lid = new BufferGeometry();
    lid.setAttribute(
      "position",
      new Float32BufferAttribute(sheet.positions, 3)
    );
    lid.setIndex(sheet.indices);
    return {
      bottom: hullGeometry(LINES, 0, SKIFF.draught + 0.03),
      inside: hullGeometry(INSIDE, 0, RIM - SKIN),
      lid,
      topside: hullGeometry(LINES, SKIFF.draught + 0.03, RIM),
    };
  }, []);
  useEffect(
    () => () => {
      parts.bottom.dispose();
      parts.inside.dispose();
      parts.lid.dispose();
      parts.topside.dispose();
    },
    [parts]
  );

  return (
    <>
      <mesh castShadow geometry={parts.bottom}>
        <SurfaceMaterial
          attach="material-0"
          color={BOAT_COLORS.antifoul}
          repeat={[1.2, 1.2]}
          roughness={0.75}
          surface="paint"
        />
      </mesh>
      <mesh castShadow geometry={parts.topside} receiveShadow>
        {children}
      </mesh>
      <mesh geometry={parts.inside} position={[0, SKIN, 0]} receiveShadow>
        <SurfaceMaterial
          attach="material-0"
          color={BOAT_COLORS.interior}
          repeat={[1.4, 1.4]}
          roughness={0.6}
          side={BackSide}
          surface="paint"
        />
      </mesh>
      {/* Drawn after the boat and before the water, into depth alone: the sea does not show inside the hull. */}
      <mesh geometry={parts.lid} position={[0, SKIN, 0]} renderOrder={5}>
        <meshBasicMaterial args={[{ colorWrite: false }]} />
      </mesh>
    </>
  );
}

/**
 * An open outboard skiff with someone at its helm: a faired, painted hull
 * over antifouling, a rubber gunwale, plank floorboards and three thwarts, a
 * fuel tank and its line, a coil of mooring rope, and the engine on the
 * transom. A simulation drives it through `ref`: the bow lifts with its
 * speed, it rides the ripples, its propeller turns and its wake trails
 * straight astern.
 *
 * @param color - The topsides' paint, which a lab ties to its legend
 * @param level - The height of the water it floats on
 * @param ref - What a simulation drives each frame
 */
export function Skiff({
  color,
  level,
  ref,
}: {
  readonly color: string;
  readonly level: number;
  readonly ref: Ref<SkiffRig>;
}) {
  const boat = useRef<Group>(null);
  const hull = useRef<Group>(null);
  const propeller = useRef<Group>(null);
  const wake = useRef<WakeRig>(null);
  const gunwale = useMemo(() => deckEdge(LINES, 0.005, -SKIN / 2), []);

  useImperativeHandle(ref, () => ({
    drive: (x, z, yaw, speed, time) => {
      boat.current?.position.set(x, level, z);
      boat.current?.rotation.set(0, yaw, 0);
      hull.current?.position.set(0, heaveAt(time, 1) - SKIFF.draught, 0);
      hull.current?.rotation.set(
        rollAt(time, 1),
        0,
        trimAt(speed, SKIFF.length)
      );
      propeller.current?.rotation.set(time * speed * 14, 0, 0);
      wake.current?.trail(speed, SKIFF.length, time);
    },
  }));

  return (
    <group ref={boat}>
      <group position={[-SKIFF.length / 2 + 0.25, 0.02, 0]}>
        <Wake ref={wake} />
      </group>
      <group ref={hull}>
        <Shell>
          <SurfaceMaterial
            attach="material-0"
            coat={0.6}
            color={color}
            repeat={[1.2, 1.2]}
            roughness={0.42}
            surface="paint"
          />
        </Shell>
        <Strake
          color={BOAT_COLORS.gunwale}
          points={gunwale}
          radius={0.028}
          surface="rubber"
        />
        <Boards />
        {Arr.map(THWARTS, (x) => (
          <RoundedBox
            args={[0.26, 0.035, 2 * breadthAt(INSIDE, x, SEAT - SKIN) - 0.01]}
            castShadow
            key={x}
            position={[x, SEAT - 0.0175, 0]}
            radius={0.012}
            receiveShadow
            smoothness={3}
          >
            <SurfaceMaterial
              coat={0.5}
              color={BOAT_COLORS.thwart}
              repeat={[1, 3]}
              roughness={0.5}
              surface="wood"
            />
          </RoundedBox>
        ))}
        <RoundedBox
          args={[0.4, 0.24, 0.28]}
          castShadow
          position={[-0.95, FLOOR + 0.125, -0.3]}
          radius={0.05}
          smoothness={4}
        >
          <SurfaceMaterial
            color={BOAT_COLORS.fuelTank}
            repeat={[2, 2]}
            roughness={0.45}
            surface="plastic"
          />
        </RoundedBox>
        <Strake
          color={BOAT_COLORS.gunwale}
          points={FUEL_LINE}
          radius={0.009}
          surface="rubber"
        />
        <Strake
          color={BOAT_COLORS.rope}
          points={COIL}
          radius={0.011}
          surface="cloth"
        />
        <group position={[-SKIFF.length / 2, 0, 0]}>
          <Outboard propeller={propeller} />
        </group>
        <group position={[-1.5, SEAT, 0.42]}>
          <Helm />
        </group>
      </group>
    </group>
  );
}
