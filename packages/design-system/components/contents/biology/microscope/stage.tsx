import { RoundedBox } from "@react-three/drei";
import {
  Blackened,
  Chrome,
  Grip,
  Turned,
} from "@repo/design-system/components/contents/biology/microscope/finish";
import {
  AXIS,
  CONDENSER,
  knobProfile,
  SLIDE,
  STAGE,
  smearOutline,
} from "@repo/design-system/components/contents/biology/microscope/form";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Path, Shape, Vector2 } from "three";

/** The profile of the small knob that racks the condenser up and down. */
const RACK_KNOB = knobProfile(0.008, 0.008);

/** The profile of the head of a clip's pivot screw. */
const SCREW = knobProfile(0.0032, 0.0016);

/**
 * The stage plate: a square of black metal with rounded corners and the
 * round opening the light comes up through, bevelled along every edge.
 */
function Plate() {
  const geometry = useMemo(() => {
    const half = STAGE.width / 2;
    const deep = STAGE.depth / 2;
    const round = 0.006;
    const plate = new Shape();
    plate.moveTo(-half + round, -deep);
    plate.lineTo(half - round, -deep);
    plate.quadraticCurveTo(half, -deep, half, -deep + round);
    plate.lineTo(half, deep - round);
    plate.quadraticCurveTo(half, deep, half - round, deep);
    plate.lineTo(-half + round, deep);
    plate.quadraticCurveTo(-half, deep, -half, deep - round);
    plate.lineTo(-half, -deep + round);
    plate.quadraticCurveTo(-half, -deep, -half + round, -deep);
    plate.holes = [
      new Path().absarc(0, 0, STAGE.opening, 0, Math.PI * 2, true),
    ];
    return new ExtrudeGeometry(plate, {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.0008,
      bevelThickness: 0.0008,
      curveSegments: 48,
      depth: STAGE.thick - 0.0016,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      castShadow
      geometry={geometry}
      position={[0, -0.0008, 0]}
      receiveShadow
      rotation={[Math.PI / 2, 0, 0]}
    >
      <Blackened repeat={[30, 30]} />
    </mesh>
  );
}

/**
 * One spring clip: a tapered leaf of spring steel that swings on a screw at
 * the back of the stage and presses down on the slide with its upturned tip.
 */
function Clip({ side }: { readonly side: -1 | 1 }) {
  const geometry = useMemo(() => {
    const leaf = new Shape();
    leaf.moveTo(-0.0042, 0);
    leaf.absarc(0, 0, 0.0042, Math.PI, 0, true);
    leaf.lineTo(0.0019, 0.043);
    leaf.absarc(0, 0.043, 0.0019, 0, Math.PI, false);
    leaf.lineTo(-0.0042, 0);
    leaf.holes = [new Path().absarc(0, 0, 0.0016, 0, Math.PI * 2, true)];
    return new ExtrudeGeometry(leaf, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.000_12,
      bevelThickness: 0.000_12,
      curveSegments: 24,
      depth: 0.0004,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[side * 0.034, 0, -0.03]} rotation={[0, side * -0.3, 0]}>
      <mesh
        castShadow
        geometry={geometry}
        position={[0, 0.0022, 0]}
        rotation={[Math.PI / 2 - 0.035, 0, 0]}
      >
        <Chrome repeat={[40, 40]} />
      </mesh>
      <mesh castShadow position={[0, 0.0026, 0]}>
        <Turned rings={SCREW} />
        <Chrome />
      </mesh>
      <mesh position={[0, 0.0012, 0]}>
        <cylinderGeometry args={[0.0022, 0.0022, 0.0024, 24]} />
        <Chrome />
      </mesh>
    </group>
  );
}

/**
 * A prepared slide: a strip of glass with ground edges and a frosted end to
 * write on, a stained smear in its middle, and a coverslip over the smear.
 */
function Slide() {
  const smear = useMemo(
    () => new Shape(Arr.map(smearOutline(48), ([x, z]) => new Vector2(x, z))),
    []
  );

  return (
    <group position={[0, SLIDE.thick / 2, 0.001]}>
      <RoundedBox
        args={[SLIDE.long, SLIDE.thick, SLIDE.wide]}
        radius={0.000_25}
        smoothness={3}
      >
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.34} />
      </RoundedBox>
      <mesh
        position={[-SLIDE.long / 2 + 0.0105, SLIDE.thick / 2 + 0.000_02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.019, SLIDE.wide - 0.0008]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.objectiveWhite}
          opacity={0.82}
          roughness={0.95}
          transparent
        />
      </mesh>
      <mesh
        position={[0, SLIDE.thick / 2 + 0.000_03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <shapeGeometry args={[smear, 24]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.methyleneBlue}
          opacity={0.5}
          roughness={0.4}
          transparent
        />
      </mesh>
      <mesh position={[0, SLIDE.thick / 2 + SLIDE.cover / 2 + 0.000_05, 0]}>
        <boxGeometry args={[0.022, SLIDE.cover, 0.022]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.22} />
      </mesh>
    </group>
  );
}

/**
 * The stage and what it carries: the plate on its bracket, two spring clips
 * holding a prepared slide over the opening, and under it the condenser
 * with its iris lever and focus knob, which gathers the lamp's light onto
 * the specimen.
 */
export function Stage() {
  return (
    <group position={[0, STAGE.top, AXIS]}>
      <Plate />
      <mesh castShadow position={[0, -0.02, -STAGE.depth / 2 - 0.004]}>
        <boxGeometry args={[0.046, 0.034, 0.03]} />
        <Blackened repeat={[2, 2]} />
      </mesh>
      <Slide />
      <Clip side={-1} />
      <Clip side={1} />
      <group position={[0, -STAGE.thick - 0.0015, 0]}>
        <mesh castShadow>
          <Turned rings={CONDENSER} />
          <Blackened repeat={[3, 2]} />
        </mesh>
        <mesh position={[0, -0.0235, 0]}>
          <cylinderGeometry args={[0.0197, 0.0197, 0.0062, 72, 1, true]} />
          <Grip along={2} around={64} />
        </mesh>
        <mesh position={[0, 0.0004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.0092, 40]} />
          <GlassMaterial color={BIOLOGY_COLORS.lensBlue} opacity={0.5} />
        </mesh>
        <group position={[0, -0.0235, 0]} rotation={[0, 0.9, 0]}>
          <mesh
            castShadow
            position={[0, 0, 0.027]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.0011, 0.0011, 0.016, 12]} />
            <Chrome />
          </mesh>
          <mesh castShadow position={[0, 0, 0.036]}>
            <sphereGeometry args={[0.0027, 20, 14]} />
            <Blackened />
          </mesh>
        </group>
        <mesh
          castShadow
          position={[-0.03, -0.014, -0.022]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <Turned rings={RACK_KNOB} />
          <Grip along={2} around={26} />
        </mesh>
      </group>
    </group>
  );
}
