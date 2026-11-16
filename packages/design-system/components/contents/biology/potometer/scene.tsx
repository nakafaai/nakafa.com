import { useFrame, useThree } from "@react-three/fiber";
import { useRunClock } from "@repo/design-system/components/contents/biology/clock";
import {
  Bung,
  FlatRule,
  GlassTube,
  LeafyShoot,
  Trestle,
  UprightClamp,
} from "@repo/design-system/components/contents/biology/glassware";
import {
  bubbleMark,
  bubbleTravel,
  type Shoot,
} from "@repo/design-system/components/contents/biology/potometer/uptake";
import {
  Beaker,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useRef } from "react";
import { type Group, type Mesh, Vector2 } from "three";

/** Where the capillary runs, in metres: from the shoot end on the left to the beaker end on the right. */
const CAPILLARY = { height: 0.118, left: -0.13, right: 0.17 } as const;

/** The capillary's glass and the water thread inside it, in metres, drawn thicker than a real bore so the eye finds it. */
const BORE = { glass: 0.0036, water: 0.0024 } as const;

/** The air bubble's length along the capillary, in metres. */
const BUBBLE = 0.012;

/** Where the shoot's upright tube stands, and how high it rises, in metres. */
const SHOOT_TUBE = { radius: 0.0075, top: 0.215, x: -0.165 } as const;

/** Where the reservoir's stem leaves the capillary, in metres. */
const RESERVOIR_X = -0.095;

/** Where the apparatus stands on the bench, clear of the reagent bottles along its back, in metres. */
const APPARATUS = [0.24, 0, 0.08] as const;

/** How many minutes pass in a second while the card plays. */
const MINUTES_PER_SECOND = 1;

/**
 * The potometer on the bench, the shoot in it, and the bubble, which is drawn
 * from the run's clock every frame, so it creeps smoothly however often the
 * card re-renders.
 */
export function PotometerScene({
  elapsed,
  minutes,
  onElapsed,
  radius,
  shoot,
}: {
  readonly elapsed: number;
  readonly minutes: number;
  readonly onElapsed: (minutes: number) => void;
  readonly radius: number;
  readonly shoot: Shoot;
}) {
  const clock = useRunClock({
    elapsed,
    onElapsed,
    perSecond: MINUTES_PER_SECOND,
    steps: 50,
    total: minutes,
  });
  const bubble = useRef<Group>(null);
  const near = useRef<Mesh>(null);
  const far = useRef<Mesh>(null);

  useFrame(() => {
    const mark = bubbleMark(bubbleTravel(shoot.rate, radius, clock.current));
    // The rule's zero stands at the capillary's beaker end, one centimetre a centimetre.
    const x = Math.max(
      CAPILLARY.left + BUBBLE / 2,
      CAPILLARY.right - mark / 100
    );
    const nearLength = Math.max(0.0001, x - BUBBLE / 2 - CAPILLARY.left);
    const farLength = Math.max(0.0001, CAPILLARY.right - x - BUBBLE / 2);
    bubble.current?.position.set(x, CAPILLARY.height, 0);
    near.current?.position.set(
      CAPILLARY.left + nearLength / 2,
      CAPILLARY.height,
      0
    );
    near.current?.scale.set(1, nearLength, 1);
    far.current?.position.set(
      CAPILLARY.right - farLength / 2,
      CAPILLARY.height,
      0
    );
    far.current?.scale.set(1, farLength, 1);
  });

  const coatUpper = shoot.coat === "upper" || shoot.coat === "both";
  const coatLower = shoot.coat === "lower" || shoot.coat === "both";

  return (
    <group>
      <PotometerCamera />
      <LabBench />
      <group position={APPARATUS}>
        <group position={[(CAPILLARY.left + CAPILLARY.right) / 2, 0, 0.012]}>
          <Trestle depth={0.06} height={0.103} length={0.32} />
          <group position={[0, 0.105, 0]}>
            <FlatRule length={0.3} step={10} zero="right" />
          </group>
        </group>

        <GlassTube
          end={[CAPILLARY.right + 0.003, CAPILLARY.height, 0]}
          opacity={0.1}
          radius={BORE.glass}
          start={[CAPILLARY.left, CAPILLARY.height, 0]}
        />
        {/* The water thread either side of the bubble, scaled along the bore each frame. */}
        <mesh ref={near} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[BORE.water, BORE.water, 1, 14]} />
          <LiquidMaterial color={MATERIAL.capillaryWater} opacity={0.85} />
        </mesh>
        <mesh ref={far} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[BORE.water, BORE.water, 1, 14]} />
          <LiquidMaterial color={MATERIAL.capillaryWater} opacity={0.85} />
        </mesh>
        <group ref={bubble}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry
              args={[BORE.water * 0.96, BUBBLE - 2 * BORE.water, 6, 14]}
            />
            <meshPhysicalMaterial
              clearcoat={1}
              clearcoatRoughness={0.02}
              color={MATERIAL.bubble}
              emissive={MATERIAL.bubble}
              emissiveIntensity={0.25}
              roughness={0.05}
            />
          </mesh>
          {Arr.map([-1, 1] as const, (side) => (
            <mesh
              key={side}
              position={[(side * BUBBLE) / 2, 0, 0]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <torusGeometry
                args={[BORE.water * 0.9, BORE.water * 0.14, 8, 24]}
              />
              <meshStandardMaterial color={MATERIAL.meniscus} roughness={0.4} />
            </mesh>
          ))}
        </group>

        {/* The bend down into the beaker, the beaker, and the water it stands in. */}
        <GlassTube
          end={[CAPILLARY.right + 0.003, 0.03, 0]}
          liquid={MATERIAL.pondWater}
          radius={BORE.glass}
          start={[CAPILLARY.right + 0.003, CAPILLARY.height, 0]}
        />
        <group position={[CAPILLARY.right + 0.003, 0, 0]}>
          <Beaker />
          <mesh position={[0, 0.026, 0]}>
            <cylinderGeometry args={[0.0245, 0.0245, 0.046, 40]} />
            <LiquidMaterial color={MATERIAL.pondWater} opacity={0.5} />
          </mesh>
        </group>

        {/* The shoot end: a short run to the upright tube, sealed by a bung around the stem. */}
        <GlassTube
          end={[SHOOT_TUBE.x, CAPILLARY.height, 0]}
          liquid={MATERIAL.pondWater}
          radius={BORE.glass * 1.6}
          start={[CAPILLARY.left + 0.002, CAPILLARY.height, 0]}
        />
        <GlassTube
          end={[SHOOT_TUBE.x, SHOOT_TUBE.top, 0]}
          liquid={MATERIAL.pondWater}
          radius={SHOOT_TUBE.radius}
          start={[SHOOT_TUBE.x, CAPILLARY.height - 0.004, 0]}
        />
        <group position={[SHOOT_TUBE.x, SHOOT_TUBE.top + 0.006, 0]}>
          <Bung height={0.018} radius={SHOOT_TUBE.radius} />
        </group>
        <group position={[SHOOT_TUBE.x, SHOOT_TUBE.top - 0.03, 0]}>
          <LeafyShoot
            coatLower={coatLower}
            coatUpper={coatUpper}
            height={0.24}
          />
        </group>
        <group position={[SHOOT_TUBE.x, 0, 0]}>
          <UprightClamp grip={SHOOT_TUBE.radius} height={0.17} reach={0.07} />
        </group>

        <Reservoir />
      </group>
    </group>
  );
}

/**
 * The reservoir that refills the capillary: a funnel of water on a stem that
 * joins the capillary near the shoot, with a glass tap. Opening the tap
 * pushes the bubble back to the start of the scale.
 */
function Reservoir() {
  const funnel = [
    new Vector2(0.0022, 0),
    new Vector2(0.0024, 0.03),
    new Vector2(0.018, 0.075),
    new Vector2(0.019, 0.078),
  ];
  return (
    <group position={[RESERVOIR_X, 0, 0]}>
      <GlassTube
        end={[0, 0.2, 0]}
        liquid={MATERIAL.pondWater}
        radius={0.0024}
        start={[0, CAPILLARY.height, 0]}
      />
      <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.014, 20]} />
        <GlassMaterial color={MATERIAL.glass} opacity={0.5} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.16, 0.012]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <boxGeometry args={[0.004, 0.026, 0.004]} />
        <MetalMaterial color={MATERIAL.chrome} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <latheGeometry args={[funnel, 32]} />
        <GlassMaterial color={MATERIAL.glass} opacity={0.32} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <latheGeometry
          args={[
            [
              new Vector2(0, 0.032),
              new Vector2(0.0024, 0.032),
              new Vector2(0.013, 0.06),
              new Vector2(0, 0.06),
            ],
            32,
          ]}
        />
        <LiquidMaterial color={MATERIAL.pondWater} opacity={0.55} />
      </mesh>
    </group>
  );
}

/** Looks along the potometer from the front and a little above, farther back on a narrow card. */
function PotometerCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 0.95 : 0.7;
  const [x, , z] = APPARATUS;
  return (
    <CameraControls
      cameraPosition={[x + 0.02, 0.16 + distance * 0.62, z + distance * 0.85]}
      cameraTarget={[x - 0.01, 0.17, z]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.16}
    />
  );
}
