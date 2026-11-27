import { RoundedBox } from "@react-three/drei";
import {
  Blackened,
  Chrome,
  Enamel,
  Grip,
  Turned,
} from "@repo/design-system/components/contents/biology/microscope/finish";
import {
  AXIS,
  EYEPIECE,
  HEAD,
  hubPlace,
  knobProfile,
  LAMP,
  LIMB,
} from "@repo/design-system/components/contents/biology/microscope/form";
import { Stage } from "@repo/design-system/components/contents/biology/microscope/stage";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  Vector2,
  Vector3,
} from "three";

/** How thick the limb is from side to side. */
const LIMB_THICK = 0.048;

/** How far the edges of the limb are rounded off, as a casting's are. */
const LIMB_ROUND = 0.011;

/** Where the axle of the focus knobs passes through the limb, as height and depth. */
const AXLE = { depth: -0.078, height: 0.078 } as const;

/** The profile of the coarse focus knob, the large one nearest the limb. */
const COARSE = knobProfile(0.024, 0.013);

/** The profile of the fine focus knob, the small one on the coarse knob's face. */
const FINE = knobProfile(0.0135, 0.011);

/** The profile of the dial that sets how bright the lamp is. */
const DIAL = knobProfile(0.011, 0.006);

/** The rubber of feet, eyecup and flex. */
function Rubber() {
  return (
    <SurfaceMaterial
      bump={0.5}
      color={BIOLOGY_COLORS.microscopeRubber}
      repeat={[4, 2]}
      roughness={0.86}
      surface="rubber"
    />
  );
}

/**
 * The cast foot: a heavy slab with a rounded front and bevelled edges on
 * four rubber feet, with the lamp's dial on one side and its switch on the
 * other.
 */
function Foot() {
  const geometry = useMemo(() => {
    const slab = new Shape();
    slab.moveTo(-0.075, 0.095);
    slab.lineTo(-0.075, -0.05);
    slab.absarc(-0.03, -0.05, 0.045, Math.PI, Math.PI * 1.5, false);
    slab.lineTo(0.03, -0.095);
    slab.absarc(0.03, -0.05, 0.045, Math.PI * 1.5, Math.PI * 2, false);
    slab.lineTo(0.075, 0.095);
    slab.absarc(0.055, 0.095, 0.02, 0, Math.PI / 2, false);
    slab.lineTo(-0.055, 0.115);
    slab.absarc(-0.055, 0.095, 0.02, Math.PI / 2, Math.PI, false);
    return new ExtrudeGeometry(slab, {
      bevelEnabled: true,
      bevelOffset: -0.007,
      bevelSegments: 7,
      bevelSize: 0.007,
      bevelThickness: 0.007,
      curveSegments: 32,
      depth: 0.013,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <mesh
        castShadow
        geometry={geometry}
        position={[0, 0.01, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <Enamel repeat={[14, 14]} />
      </mesh>
      {Arr.map(
        [
          [-0.058, 0.07],
          [0.058, 0.07],
          [-0.058, -0.09],
          [0.058, -0.09],
        ] as const,
        ([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, 0.0015, z]}>
            <cylinderGeometry args={[0.011, 0.0115, 0.003, 32]} />
            <Rubber />
          </mesh>
        )
      )}
      <mesh
        castShadow
        position={[0.079, 0.016, 0.045]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <Turned rings={DIAL} />
        <Grip along={2} around={30} />
      </mesh>
      <RoundedBox
        args={[0.004, 0.009, 0.016]}
        position={[-0.0795, 0.016, 0.045]}
        radius={0.0012}
        rotation={[0, 0, 0.12]}
        smoothness={3}
      >
        <Blackened />
      </RoundedBox>
    </group>
  );
}

/**
 * The lamp in the foot: a blackened collar around a field lens, lit from
 * below, which sends its light up through the condenser.
 */
function Lamp() {
  return (
    <group position={[0, 0.03, AXIS]}>
      <mesh castShadow>
        <Turned rings={LAMP} />
        <Blackened repeat={[3, 1]} />
      </mesh>
      <mesh position={[0, 0.0086, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.0164, 48]} />
        <meshBasicMaterial
          color={BIOLOGY_COLORS.microscopeLamp}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, -0.0158, 0]}>
        <sphereGeometry args={[0.03, 48, 12, 0, Math.PI * 2, 0, 0.578]} />
        <GlassMaterial color={BIOLOGY_COLORS.microscopeLamp} opacity={0.28} />
      </mesh>
    </group>
  );
}

/**
 * The limb: one casting that rises from the back of the foot, leans over
 * the stage and carries the head, cut from its side outline and bevelled
 * all round.
 */
function Limb() {
  const geometry = useMemo(() => {
    const [start, ...back] = LIMB.back;
    const [turn, ...inside] = LIMB.inside;
    const side = new Shape();
    side.moveTo(-start[0], start[1]);
    side.splineThru(Arr.map(back, ([depth, y]) => new Vector2(-depth, y)));
    side.lineTo(-turn[0], turn[1]);
    side.splineThru(Arr.map(inside, ([depth, y]) => new Vector2(-depth, y)));
    side.closePath();
    return new ExtrudeGeometry(side, {
      bevelEnabled: true,
      bevelOffset: -LIMB_ROUND,
      bevelSegments: 7,
      bevelSize: LIMB_ROUND,
      bevelThickness: LIMB_ROUND,
      curveSegments: 40,
      depth: LIMB_THICK - 2 * LIMB_ROUND,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      castShadow
      geometry={geometry}
      position={[-LIMB_THICK / 2 + LIMB_ROUND, 0, 0]}
      receiveShadow
      rotation={[0, Math.PI / 2, 0]}
    >
      <Enamel repeat={[12, 12]} />
    </mesh>
  );
}

/**
 * The focus knobs on one side of the limb, on one axle: the large coarse
 * knob that racks the stage quickly and the small fine knob on its face.
 */
function FocusKnobs({ side }: { readonly side: -1 | 1 }) {
  return (
    <group
      position={[side * (LIMB_THICK / 2), AXLE.height, AXLE.depth]}
      rotation={[0, 0, (-side * Math.PI) / 2]}
    >
      <mesh castShadow position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.0075, 0.0075, 0.004, 32]} />
        <Chrome />
      </mesh>
      <mesh castShadow position={[0, 0.003, 0]}>
        <Turned rings={COARSE} />
        <Blackened repeat={[4, 2]} />
      </mesh>
      <mesh position={[0, 0.0095, 0]}>
        <cylinderGeometry args={[0.0242, 0.0242, 0.0092, 96, 1, true]} />
        <Grip along={3} around={56} />
      </mesh>
      <mesh castShadow position={[0, 0.0145, 0]}>
        <Turned rings={FINE} />
        <Blackened repeat={[4, 2]} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.0137, 0.0137, 0.0078, 72, 1, true]} />
        <Grip along={3} around={34} />
      </mesh>
    </group>
  );
}

/**
 * The head: the prism housing on top of the limb and the eyepiece tube
 * inclined toward the eye, with the knurled eyepiece, its rubber eyecup and
 * its eye lens.
 */
function Head() {
  return (
    <group position={[0, 0.276, AXIS]}>
      <mesh castShadow>
        <Turned rings={HEAD} />
        <Enamel repeat={[6, 3]} />
      </mesh>
      <group position={[0, 0.022, 0.008]} rotation={[0.72, 0, 0]}>
        <mesh castShadow position={[0, 0.026, 0]}>
          <cylinderGeometry args={[0.0122, 0.0122, 0.052, 64]} />
          <Blackened repeat={[3, 3]} />
        </mesh>
        <group position={[0, 0.052, 0]}>
          <mesh castShadow>
            <Turned rings={EYEPIECE} />
            <Rubber />
          </mesh>
          <mesh position={[0, 0.013, 0]}>
            <cylinderGeometry
              args={[0.015_35, 0.015_35, 0.0115, 72, 1, true]}
            />
            <Grip along={3} around={46} />
          </mesh>
          <mesh position={[0, 0.0305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.0104, 40]} />
            <GlassMaterial color={BIOLOGY_COLORS.lensBlue} opacity={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * The bench's back rail as the mains flex meets it: how far behind the
 * microscope its face stands and how high it is, in metres.
 */
interface Rail {
  readonly behind: number;
  readonly high: number;
}

/** How deep a bench's back rail is, front to back, in metres. */
const RAIL_DEEP = 0.016;

/** How thick the mains flex is, as its radius in metres. */
const FLEX_RADIUS = 0.0032;

/** How far the middle of the flex stays from what it lies against: its radius and a hair of air. */
const FLEX_CLEAR = FLEX_RADIUS + 0.0013;

/**
 * The mains flex: out of the back of the foot through its strain relief,
 * across the bench, up and over the back rail and down behind it to the
 * socket, so it ends nowhere in sight.
 */
function Flex({ rail }: { readonly rail: Rail }) {
  const run = useMemo(() => {
    const face = -rail.behind + FLEX_CLEAR;
    const back = -rail.behind - RAIL_DEEP - FLEX_CLEAR;
    const over = rail.high + FLEX_CLEAR;
    return new CatmullRomCurve3([
      new Vector3(0, 0.016, -0.112),
      new Vector3(0, 0.013, -0.135),
      new Vector3(0.008, 0.005, -0.17),
      new Vector3(0.03, FLEX_RADIUS, -0.23),
      new Vector3(0.046, FLEX_RADIUS, -0.33),
      new Vector3(0.04, FLEX_RADIUS, face + 0.05),
      new Vector3(0.04, FLEX_RADIUS + 0.002, face + 0.012),
      new Vector3(0.04, rail.high * 0.35, face),
      new Vector3(0.04, rail.high - 0.006, face),
      new Vector3(0.04, over - 0.001, face - 0.0035),
      new Vector3(0.04, over, -rail.behind - RAIL_DEEP / 2),
      new Vector3(0.04, over - 0.001, back + 0.0035),
      new Vector3(0.04, rail.high - 0.006, back),
      new Vector3(0.04, -0.12, back),
    ]);
  }, [rail.behind, rail.high]);

  return (
    <group>
      <mesh castShadow>
        <tubeGeometry args={[run, 220, FLEX_RADIUS, 12, false]} />
        <Rubber />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.016, -0.121]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.0042, 0.0062, 0.016, 24]} />
        <Rubber />
      </mesh>
    </group>
  );
}

/**
 * A school compound microscope at real size, in metres, standing on its
 * foot at the origin and facing the reader: a cast enamel foot with a lit
 * lamp, a limb with coarse and fine focus knobs on both sides, a stage with
 * spring clips holding a prepared slide over the condenser, a revolving
 * nosepiece, and an inclined eyepiece. Its children hang at the hub of the
 * nosepiece: the turret of objectives the lab chooses from.
 *
 * @param children - The turret that hangs at the nosepiece's hub
 * @param rail - The bench's back rail, which the mains flex climbs over
 */
export function Microscope({
  children,
  rail,
}: {
  readonly children: ReactNode;
  readonly rail: Rail;
}) {
  const hub = hubPlace();

  return (
    <group>
      <Foot />
      <Lamp />
      <Flex rail={rail} />
      <Limb />
      <FocusKnobs side={-1} />
      <FocusKnobs side={1} />
      <Stage />
      <group position={[0, hub.height, hub.depth]}>{children}</group>
      <Head />
    </group>
  );
}
