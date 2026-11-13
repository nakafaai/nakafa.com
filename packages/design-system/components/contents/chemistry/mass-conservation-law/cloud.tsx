import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Beaker,
  LabBench,
  Scale,
  type ScaleRig,
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  type Ref,
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Color,
  type Group,
  type InstancedMesh,
  type Mesh,
  MeshPhysicalMaterial,
} from "three";

/** The pour takes three seconds; the cloud then settles for five. */
const POUR = 3;
const SETTLE = 5;

/** Each beaker's solution fills it to 25 mm; together they fill one to 50 mm. */
const LEVEL = 0.025;

/** How many specks of silver chloride the cloud draws. */
const SPECKS = 220;

/** The two beakers stand side by side on the pan. */
const LEFT = -0.035;
const RIGHT = 0.035;

/** Clear water, and the milky white the precipitate makes of it. */
const CLEAR = new Color(MATERIAL.solution);
const MILKY = new Color(MATERIAL.milkySolution);

/**
 * Two clear solutions stand side by side on a balance: silver nitrate on the
 * left, table salt on the right. The left beaker pours into the right, and a
 * white cloud of silver chloride appears at once, AgNO₃ + NaCl → AgCl + NaNO₃.
 * Nothing enters or leaves the beakers, so the reading never moves even
 * though a new solid formed.
 */
export function PrecipitateLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly precipitate: ReactNode;
    readonly readingAfter: ReactNode;
    readonly readingBefore: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
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
              cameraPosition={[0.22, 0.3, 0.52]}
              cameraTarget={[0, 0.12, 0]}
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

/** A beaker's liquid: a cylinder whose height the scene sets each frame. */
function Liquid({
  children,
  ref,
}: {
  readonly children: ReactNode;
  readonly ref: Ref<Mesh>;
}) {
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.0235, 0.0235, 1, 32]} />
      {children}
    </mesh>
  );
}

/** Sets a liquid cylinder to fill its beaker from the floor to `level`. */
function fill(liquid: Mesh | null, level: number) {
  if (!liquid) {
    return;
  }
  liquid.visible = level > 0.001;
  liquid.scale.y = Math.max(0.001, level);
  liquid.position.y = 0.003 + level / 2;
}

/** The bench, the balance and the two beakers, run by the play clock. */
function CloudScene({ total }: { readonly total: number }) {
  const scale = useRef<ScaleRig>(null);
  const pourer = useRef<Group>(null);
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);
  const stream = useRef<Mesh>(null);
  const specks = useRef<InstancedMesh>(null);
  const reading = useReading();
  const { advance, playing } = useTimeline(-1, POUR + SETTLE);
  const milk = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.6,
        color: CLEAR,
        depthWrite: false,
        opacity: 0.5,
        roughness: 0.12,
        transparent: true,
      }),
    []
  );
  useEffect(() => () => milk.dispose(), [milk]);

  useFrame(({ clock }, delta) => {
    const time = advance(delta);
    const poured = Math.min(1, Math.max(0, time / POUR));
    const lift =
      Math.min(1, Math.max(0, (time + 1) / 1)) * (time < POUR + 1 ? 1 : 0);
    pourer.current?.position.set(LEFT + lift * 0.04, lift * 0.06, 0);
    pourer.current?.rotation.set(0, 0, -lift * 1.7);
    fill(left.current, LEVEL * (1 - poured));
    fill(right.current, LEVEL * (1 + poured));
    if (stream.current) {
      stream.current.visible = poured > 0 && poured < 1;
    }
    milk.color.copy(CLEAR).lerp(MILKY, poured);
    milk.opacity = 0.5 + 0.4 * poured;
    const settled = Math.min(1, Math.max(0, (time - POUR) / SETTLE));
    Arr.forEach(specks.current?.children ?? [], (speck, index) => {
      const born = hashUnit(index, 1) < poured;
      const height =
        0.004 + hashUnit(index, 2) * (LEVEL * 2 - 0.006) * (1 - settled * 0.9);
      const swirl = clock.elapsedTime * 0.3 + hashUnit(index, 3) * 6.28;
      const radius = 0.02 * Math.sqrt(hashUnit(index, 4));
      speck.position.set(
        Math.cos(swirl) * radius,
        height,
        Math.sin(swirl) * radius
      );
      speck.scale.setScalar(born ? 1 : 0);
    });
    scale.current?.show(reading(total, 2));
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <LabBench />
      <Scale ref={scale} unitLabel="g">
        <group position={[LEFT, 0, 0]} ref={pourer}>
          <Beaker />
          <Liquid ref={left}>
            <LiquidMaterial color={MATERIAL.solution} opacity={0.5} />
          </Liquid>
        </group>
        <group position={[RIGHT, 0, 0]}>
          <Beaker />
          <Liquid ref={right}>
            <primitive attach="material" object={milk} />
          </Liquid>
          <Instances limit={SPECKS} ref={specks}>
            <icosahedronGeometry args={[0.0011, 0]} />
            <meshStandardMaterial
              color={MATERIAL.precipitate}
              roughness={0.9}
            />
            {Arr.map(Arr.range(1, SPECKS), (index) => (
              <Instance key={index} />
            ))}
          </Instances>
          <mesh position={[-0.012, 0.085, 0]} ref={stream}>
            <cylinderGeometry args={[0.0025, 0.0018, 0.07, 12]} />
            <LiquidMaterial color={MATERIAL.solution} opacity={0.55} />
          </mesh>
        </group>
      </Scale>
    </>
  );
}
