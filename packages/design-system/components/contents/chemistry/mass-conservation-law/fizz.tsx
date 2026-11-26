import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ScaleRig } from "@repo/design-system/components/contents/chemistry/bench";
import {
  Flask,
  FlaskLiquid,
  flaskRadiusAt,
  LabBench,
  Scale,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  carbonDioxideFrom,
  FIZZ_TIME,
  fizzProgress,
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
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group, InstancedMesh, Mesh, Object3D } from "three";
import { Vector2 } from "three";

/** Whether the flask stays open to the air or is closed with a stopper. */
const SealSchema = Schema.Literals(["open", "closed"]);
type Seal = typeof SealSchema.Type;

/** The lab's amounts: 100.00 g of vinegar and 2.00 g of baking soda. */
const VINEGAR = 100;
const SODA = 2;

/** The vinegar fills the flask to 50 mm. */
const LEVEL = 0.05;

/** How many bubbles, powder grains, and CO2 wisps the scene draws. */
const BUBBLES = 56;
const GRAINS = 36;
const WISPS = 24;

/** The run: two seconds to lift and pour the soda, then five reaction times. */
const START = -2.1;
const END = 5 * FIZZ_TIME;

/** Rest position of the porcelain weighing dish on the balance pan. */
const DISH_HOME_X = 0.068;
const DISH_HOME_Y = 0.001;

/** Sculpted concave porcelain weighing dish profile. */
function createDishProfile() {
  return Arr.map(
    [
      [0.001, 0],
      [0.019, 0],
      [0.025, 0.003],
      [0.0275, 0.009],
      [0.026, 0.01],
      [0.0235, 0.0045],
      [0.017, 0.002],
      [0.001, 0.0018],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
}

/** Hermite smoothstep clamped to [0, 1]. */
function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Baking soda lifts from a porcelain weighing dish above a conical flask of
 * vinegar on a balance, tips cleanly into the neck without clipping the pan
 * or flask, and returns to the pan as carbon dioxide fizzes out. Open, the
 * gas escapes and the balance drops; sealed, the stopper holds the gas inside
 * and the mass stays steady.
 */
export function FizzBalanceLab({
  description,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly chooseSeal: string;
    readonly gasEscaped: ReactNode;
    readonly gasFormed: ReactNode;
    readonly readingAfter: ReactNode;
    readonly readingBefore: ReactNode;
    readonly seals: Readonly<Record<Seal, string>>;
    readonly viewLabel: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [seal, setSeal] = useState<Seal>("open");
  const quantity = useQuantity();
  const gas = carbonDioxideFrom(SODA);
  const before = VINEGAR + SODA;
  const after = seal === "open" ? before - gas : before;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSeal}
          onValueChange={(value: string) => {
            if (Schema.is(SealSchema)(value)) {
              setSeal(value);
            }
          }}
          type="single"
          value={seal}
          variant="outline"
        >
          {Arr.map(SealSchema.literals, (each) => (
            <ToggleGroupItem key={each} value={each}>
              {labels.seals[each]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.6} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.3, 0.35, 0.62]}
              cameraTarget={[0, 0.13, 0]}
              fov={34}
              maxDistance={1.6}
              minDistance={0.35}
            />
            <FizzScene seal={seal} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.readingBefore}
            value={<InlineMath math={quantity(before, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.readingAfter}
            value={<InlineMath math={quantity(after, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.gasFormed}
            value={<InlineMath math={quantity(gas, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.gasEscaped}
            value={
              <InlineMath
                math={quantity(seal === "open" ? gas : 0, "\\text{ g}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The bench, the balance, the flask of vinegar and the weighing dish of soda. */
function FizzScene({ seal }: { readonly seal: Seal }) {
  const scale = useRef<ScaleRig>(null);
  const dish = useRef<Group>(null);
  const stopper = useRef<Group>(null);
  const powder = useRef<Mesh>(null);
  const grains = useRef<InstancedMesh>(null);
  const foam = useRef<Mesh>(null);
  const bubbles = useRef<InstancedMesh>(null);
  const wisps = useRef<InstancedMesh>(null);
  const reading = useReading();
  const gas = carbonDioxideFrom(SODA);
  const { advance, playing } = useTimeline(START, END);
  const dishPoints = useMemo(createDishProfile, []);

  useFrame(({ clock }, delta) => {
    const time = advance(delta);
    const progress = fizzProgress(time);
    const rate = time <= 0 ? 0 : Math.exp(-time / FIZZ_TIME);
    const escaped = seal === "open" ? gas * progress : 0;
    scale.current?.show(reading(VINEGAR + SODA - escaped, 2));

    // Lift dish cleanly above the 0.147 m flask mouth, tip in, then return to pan
    const liftUp = smooth(-1.95, -1.15, time);
    const lowerBack = smooth(0.05, 0.85, time);
    const lift = liftUp * (1 - lowerBack);
    const tipIn = smooth(-1.15, -0.55, time);
    const tipOut = smooth(-0.15, 0.2, time);
    const tip = tipIn * (1 - tipOut);

    if (dish.current) {
      dish.current.position.set(
        DISH_HOME_X + lift * (0.025 - DISH_HOME_X),
        DISH_HOME_Y + lift * 0.172,
        0
      );
      dish.current.rotation.set(0, 0, tip * 1.12);
    }

    // In sealed mode, rubber stopper lifts briefly while soda drops in, then seals
    if (stopper.current) {
      const openForDrop =
        smooth(-1.95, -1.35, time) * (1 - smooth(0.05, 0.55, time));
      stopper.current.position.set(
        -openForDrop * 0.036,
        0.151 + openForDrop * 0.044,
        -openForDrop * 0.018
      );
      stopper.current.rotation.set(0, 0, openForDrop * 0.35);
    }

    const pouredShare = smooth(-0.85, -0.05, time);
    if (powder.current) {
      const leftScale = Math.max(0, 1 - pouredShare);
      powder.current.visible = leftScale > 0.04;
      powder.current.scale.set(leftScale, leftScale, leftScale);
    }

    // Falling stream of white sodium bicarbonate granules down the flask neck
    const pouring = pouredShare > 0.02 && pouredShare < 0.98;
    if (grains.current) {
      grains.current.visible = pouring;
      Arr.forEach(grains.current.children, (grain, index) => {
        const u = (clock.elapsedTime * 2.8 + hashUnit(index, 7)) % 1;
        const spread = 0.0055 * (0.5 + 0.5 * u);
        grain.position.set(
          (hashUnit(index, 1) - 0.5) * spread,
          0.166 - u * (0.166 - LEVEL),
          (hashUnit(index, 2) - 0.5) * spread
        );
        grain.scale.setScalar(pouring ? 0.8 + 0.5 * hashUnit(index, 3) : 0);
      });
    }

    if (foam.current) {
      foam.current.scale.set(1, 0.3 + 2.8 * rate, 1);
      foam.current.visible = rate > 0.02;
    }

    moveParticles(bubbles.current, clock.elapsedTime, rate, (unit, index) => {
      const y = 0.006 + unit * (LEVEL - 0.008);
      const maxR = Math.max(0.004, flaskRadiusAt(y) - 0.0045);
      const r = maxR * Math.sqrt(hashUnit(index, 1));
      const a = hashUnit(index, 2) * Math.PI * 2;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });

    moveParticles(
      seal === "open" ? wisps.current : null,
      clock.elapsedTime * 0.45,
      rate,
      (unit, index) => [
        (hashUnit(index, 3) - 0.5) * 0.026 * (1 + unit * 2.8),
        0.152 + unit * 0.2,
        (hashUnit(index, 4) - 0.5) * 0.026 * (1 + unit * 2.8),
      ]
    );
    if (wisps.current) {
      wisps.current.visible = seal === "open";
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <LabBench />
      <Scale ref={scale} unitLabel="g">
        <Flask />
        <FlaskLiquid
          color={REAGENT_COLORS.vinegar}
          level={LEVEL}
          opacity={0.44}
        />
        <mesh position={[0, LEVEL + 0.002, 0]} ref={foam} visible={false}>
          <cylinderGeometry
            args={[
              flaskRadiusAt(LEVEL) - 0.003,
              flaskRadiusAt(LEVEL) - 0.002,
              0.004,
              36,
            ]}
          />
          <meshStandardMaterial color={REAGENT_COLORS.foam} roughness={0.92} />
        </mesh>
        <Instances limit={GRAINS} ref={grains} visible={false}>
          <icosahedronGeometry args={[0.0012, 0]} />
          <meshStandardMaterial
            color={REAGENT_COLORS.bakingSoda}
            roughness={0.95}
          />
          {Arr.map(Arr.range(1, GRAINS), (index) => (
            <Instance key={index} />
          ))}
        </Instances>
        <Instances limit={BUBBLES} ref={bubbles}>
          <sphereGeometry args={[0.0019, 10, 8]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={getColor("WHITE")}
            opacity={0.75}
            roughness={0.05}
            transparent
          />
          {Arr.map(Arr.range(1, BUBBLES), (index) => (
            <Instance key={index} />
          ))}
        </Instances>
        <Instances limit={WISPS} ref={wisps}>
          <sphereGeometry args={[0.011, 12, 10]} />
          <meshBasicMaterial
            color={REAGENT_COLORS.gasWisp}
            depthWrite={false}
            opacity={0.09}
            transparent
          />
          {Arr.map(Arr.range(1, WISPS), (index) => (
            <Instance key={index} />
          ))}
        </Instances>
        {seal === "closed" ? (
          <group position={[0, 0.151, 0]} ref={stopper}>
            <mesh castShadow>
              <cylinderGeometry args={[0.0185, 0.0145, 0.025, 28]} />
              <meshStandardMaterial
                color={BENCH_COLORS.stopper}
                roughness={0.86}
              />
            </mesh>
          </group>
        ) : null}
        {/* Sculpted porcelain weighing dish that lifts cleanly over the flask neck */}
        <group position={[DISH_HOME_X, DISH_HOME_Y, 0]} ref={dish}>
          <mesh castShadow receiveShadow>
            <latheGeometry args={[dishPoints, 36]} />
            <meshPhysicalMaterial
              clearcoat={0.55}
              clearcoatRoughness={0.22}
              color={BENCH_COLORS.dish}
              roughness={0.32}
            />
          </mesh>
          <mesh position={[0, 0.003, 0]} ref={powder}>
            <sphereGeometry
              args={[0.015, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial
              color={REAGENT_COLORS.bakingSoda}
              roughness={0.96}
            />
          </mesh>
        </group>
      </Scale>
    </>
  );
}

/**
 * Moves a group of particle instances: each one rises from 0 to 1 along its
 * own path on its own phase, and only a share of them as large as `rate`
 * shows, so the fizz dies down as the soda runs out.
 */
function moveParticles(
  group: Object3D | null,
  elapsed: number,
  rate: number,
  place: (unit: number, index: number) => readonly [number, number, number]
) {
  if (!group) {
    return;
  }
  Arr.forEach(group.children, (child, index) => {
    const unit =
      (elapsed * (0.6 + hashUnit(index, 9)) + hashUnit(index, 5)) % 1;
    const [x, y, z] = place(unit, index);
    child.position.set(x, y, z);
    child.scale.setScalar(hashUnit(index, 6) < rate ? 1 : 0);
  });
}
