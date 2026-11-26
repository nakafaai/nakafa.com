import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ScaleRig } from "@repo/design-system/components/contents/chemistry/bench";
import {
  Beaker,
  LabBench,
  Scale,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  COMPOUND,
  PRECIPITATE,
  precipitateMass,
  saltMass,
} from "@repo/design-system/components/contents/chemistry/mass-conservation-law/masses";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { LiquidMaterial } from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr } from "effect";
import type { ReactNode, Ref } from "react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { Group, InstancedMesh, Mesh } from "three";
import {
  CatmullRomCurve3,
  Color,
  MeshPhysicalMaterial,
  TubeGeometry,
  Vector3,
} from "three";

/** Smooth 4-stage choreography: lift, pour, return, and settle. */
const LIFT_END = 0.85;
const POUR_END = 3.65;
const RETURN_END = 4.5;
const SETTLE_END = 8.4;

/** Each beaker's solution fills it to 25 mm; together they fill one to 50 mm. */
const LEVEL = 0.025;

/** How many crystalline specks of silver chloride the precipitate cloud draws. */
const SPECKS = 240;

/** The two 100 mL beakers stand cleanly spaced on the 200 mm balance pan. */
const LEFT = -0.044;
const RIGHT = 0.038;

/** Local coordinates of the left beaker's pouring spout lip. */
const SPOUT_X = 0.0275;
const SPOUT_Y = 0.072;

/** Target translation of the left beaker's base while elevated for pouring. */
const LIFT_DX = 0.032;
const LIFT_DY = 0.036;

/** Clear water, and the milky white suspension silver chloride forms. */
const CLEAR = new Color(REAGENT_COLORS.solution);
const MILKY = new Color(REAGENT_COLORS.milkySolution);

/** Hermite smoothstep clamped to [0, 1]. */
function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Two clear solutions stand side by side on a balance: silver nitrate on the
 * left, table salt on the right. The left beaker lifts cleanly above the right
 * beaker's rim, pours a curved stream of silver nitrate into the salt solution,
 * and returns to the pan while a white cloud of silver chloride blooms and
 * settles, AgNO3 + NaCl -> AgCl + NaNO3. Nothing enters or leaves the system,
 * so the reading stays put.
 */
export function PrecipitateLab({
  description,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly precipitate: ReactNode;
    readonly readingAfter: ReactNode;
    readonly readingBefore: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const quantity = useQuantity();
  const total =
    2 * PRECIPITATE.water + saltMass(COMPOUND.agno3) + saltMass(COMPOUND.nacl);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.6} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.2, 0.31, 0.54]}
              cameraTarget={[0, 0.13, 0]}
              fov={32}
              maxDistance={1.4}
              minDistance={0.3}
            />
            <CloudScene total={total} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.readingBefore}
            value={<InlineMath math={quantity(total, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.readingAfter}
            value={<InlineMath math={quantity(total, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.precipitate}
            value={
              <InlineMath math={quantity(precipitateMass(), "\\text{ g}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** A beaker's liquid column whose height the scene sets each frame. */
function Liquid({
  children,
  ref,
}: {
  readonly children: ReactNode;
  readonly ref: Ref<Mesh>;
}) {
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.0238, 0.0238, 1, 36]} />
      {children}
    </mesh>
  );
}

/** Sets a liquid cylinder to fill its beaker from the inner glass floor to `level`. */
function fill(liquid: Mesh | null, level: number) {
  if (!liquid) {
    return;
  }
  liquid.visible = level > 0.001;
  liquid.scale.y = Math.max(0.001, level);
  liquid.position.y = 0.0038 + level / 2;
}

/**
 * Curved parabolic liquid stream from the elevated pouring spout (world
 * x = LEFT + LIFT_DX + SPOUT_X = +0.0155, y = LIFT_DY + SPOUT_Y = 0.108)
 * into the center of the right beaker (world x = RIGHT = +0.038).
 */
function createPourStreamGeometry(): TubeGeometry {
  const startX = LEFT + LIFT_DX + SPOUT_X - RIGHT;
  const startY = LIFT_DY + SPOUT_Y - 0.002;
  const curve = new CatmullRomCurve3([
    new Vector3(startX, startY, 0),
    new Vector3(startX + 0.009, startY - 0.014, 0),
    new Vector3(startX + 0.016, startY - 0.042, 0),
    new Vector3(0, 0.026, 0),
  ]);
  return new TubeGeometry(curve, 32, 0.0018, 12, false);
}

/** The bench, the analytical balance, and the two beakers, driven by the transport clock. */
function CloudScene({ total }: { readonly total: number }) {
  const scale = useRef<ScaleRig>(null);
  const pourerLift = useRef<Group>(null);
  const pourerTilt = useRef<Group>(null);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const stream = useRef<Mesh>(null);
  const sediment = useRef<Mesh>(null);
  const specks = useRef<InstancedMesh>(null);
  const reading = useReading();
  const { advance, playing } = useTimeline(-0.5, SETTLE_END);

  const pourStreamGeometry = useMemo(createPourStreamGeometry, []);
  const milk = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.65,
        color: CLEAR,
        depthWrite: false,
        opacity: 0.48,
        roughness: 0.12,
        transparent: true,
      }),
    []
  );

  useEffect(
    () => () => {
      pourStreamGeometry.dispose();
      milk.dispose();
    },
    [milk, pourStreamGeometry]
  );

  useFrame(({ clock }, delta) => {
    const time = advance(delta);

    // Phase 1: lift up cleanly above right beaker; Phase 3: lower back onto pan
    const liftUp = smooth(0, LIFT_END, time);
    const putDown = smooth(POUR_END, RETURN_END, time);
    const lift = liftUp * (1 - putDown);

    // Phase 2: pivot smoothly around the pouring spout lip (zero collision!)
    const tiltIn = smooth(LIFT_END - 0.15, LIFT_END + 0.45, time);
    const tiltOut = smooth(POUR_END - 0.35, POUR_END + 0.15, time);
    const tilt = tiltIn * (1 - tiltOut);

    // Liquid transfer occurs strictly while the spout hovers tilted above the target
    const poured = smooth(LIFT_END + 0.1, POUR_END - 0.2, time);

    pourerLift.current?.position.set(LEFT + lift * LIFT_DX, lift * LIFT_DY, 0);
    pourerTilt.current?.rotation.set(0, 0, -tilt * 1.18);

    fill(left.current, LEVEL * (1 - poured));
    fill(right.current, LEVEL * (1 + poured));

    if (stream.current) {
      const flowEnvelope = Math.sin(poured * Math.PI);
      const active = poured > 0.015 && poured < 0.985 && tilt > 0.45;
      stream.current.visible = active;
      stream.current.scale.set(
        0.55 + 0.6 * flowEnvelope,
        1,
        0.55 + 0.6 * flowEnvelope
      );
    }

    milk.color.copy(CLEAR).lerp(MILKY, Math.min(1, poured * 1.15));
    milk.opacity = 0.48 + 0.38 * poured;

    const settled = smooth(POUR_END, SETTLE_END, time);
    if (sediment.current) {
      const bedHeight = 0.0055 * poured * (0.2 + 0.8 * settled);
      sediment.current.visible = bedHeight > 0.0005;
      sediment.current.scale.y = Math.max(0.001, bedHeight);
      sediment.current.position.y = 0.0038 + bedHeight / 2;
    }

    Arr.forEach(specks.current?.children ?? [], (speck, index) => {
      const born = hashUnit(index, 1) < poured;
      const spread = 1 - settled * 0.86;
      const height =
        0.005 + hashUnit(index, 2) * (LEVEL * 1.85 - 0.006) * spread;
      const swirl =
        clock.elapsedTime * (0.28 + 0.25 * (1 - settled)) +
        hashUnit(index, 3) * 6.28;
      const radius = 0.021 * Math.sqrt(hashUnit(index, 4));
      speck.position.set(
        Math.cos(swirl) * radius,
        height,
        Math.sin(swirl) * radius
      );
      speck.scale.setScalar(born ? 0.85 + 0.45 * hashUnit(index, 5) : 0);
    });

    scale.current?.show(reading(total, 2));
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <LabBench />
      <Scale ref={scale} unitLabel="g">
        {/* Left silver nitrate beaker, pivoting cleanly around its pouring spout */}
        <group position={[LEFT, 0, 0]} ref={pourerLift}>
          <group position={[SPOUT_X, SPOUT_Y, 0]} ref={pourerTilt}>
            <group position={[-SPOUT_X, -SPOUT_Y, 0]}>
              <Beaker />
              <Liquid ref={left}>
                <LiquidMaterial color={REAGENT_COLORS.solution} opacity={0.5} />
              </Liquid>
            </group>
          </group>
        </group>

        {/* Right sodium chloride beaker receiving stream & forming AgCl precipitate */}
        <group position={[RIGHT, 0, 0]}>
          <Beaker />
          <Liquid ref={right}>
            <primitive attach="material" object={milk} />
          </Liquid>
          {/* Settled white silver chloride sediment layer */}
          <mesh position={[0, 0.005, 0]} ref={sediment} visible={false}>
            <cylinderGeometry args={[0.0232, 0.0232, 1, 32]} />
            <meshStandardMaterial
              color={REAGENT_COLORS.precipitate}
              roughness={0.88}
            />
          </mesh>
          {/* Micro-crystalline AgCl precipitate cloud */}
          <Instances limit={SPECKS} ref={specks}>
            <icosahedronGeometry args={[0.001, 0]} />
            <meshStandardMaterial
              color={REAGENT_COLORS.precipitate}
              roughness={0.85}
            />
            {Arr.map(Arr.range(1, SPECKS), (index) => (
              <Instance key={index} />
            ))}
          </Instances>
          {/* Curved gravity-arched pouring stream from spout into solution */}
          <mesh geometry={pourStreamGeometry} ref={stream} visible={false}>
            <LiquidMaterial color={BENCH_COLORS.streamGlint} opacity={0.8} />
          </mesh>
        </group>
      </Scale>
    </>
  );
}
