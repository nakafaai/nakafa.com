import { useFrame } from "@react-three/fiber";
import {
  LabBench,
  Scale,
  type ScaleRig,
} from "@repo/design-system/components/contents/chemistry/bench";
import { oxygenTakenBy } from "@repo/design-system/components/contents/chemistry/mass-conservation-law/masses";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Schema } from "effect";
import {
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  type BufferGeometry,
  CatmullRomCurve3,
  Color,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Whether the wool burns in the open air or inside a sealed jar of air. */
const SealSchema = Schema.Literals(["open", "closed"]);
type Seal = typeof SealSchema.Type;

/** The lab burns 1.50 g of steel wool, all of it, in the ideal model. */
const WOOL = 1.5;

/** The glowing front crosses the tuft in six seconds. */
const BURN_TIME = 6;

/** The tuft: forty strands curling through a pad 70 mm wide. */
const STRANDS = 40;
const STRAND_POINTS = 9;
const TUFT = { depth: 0.045, height: 0.03, width: 0.07 } as const;

/** Steel before, the glowing front, and the blue-black oxide after. */
const STEEL = new Color(MATERIAL.steelWool);
const OXIDE = new Color(MATERIAL.ironOxide);
const GLOW = new Color(MATERIAL.woolGlow);

/**
 * A tuft of steel wool on a heatproof tile on a balance. Touched with a
 * battery, it glows and burns: each gram of iron that burns takes oxygen out
 * of the air and becomes blue-black iron oxide, so the reading climbs. In a
 * sealed jar the oxygen was already on the balance, and the reading stays.
 */
export function SteelWoolLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly chooseSeal: string;
    readonly oxygenJoined: ReactNode;
    readonly readingAfter: ReactNode;
    readonly readingBefore: ReactNode;
    readonly seals: Readonly<Record<Seal, string>>;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [seal, setSeal] = useState<Seal>("open");
  const quantity = useQuantity();
  const oxygen = oxygenTakenBy(WOOL);

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
              cameraPosition={[0.26, 0.3, 0.5]}
              cameraTarget={[0, 0.1, 0]}
              fov={32}
              maxDistance={1.4}
              minDistance={0.3}
            />
            <WoolScene seal={seal} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.readingBefore}
            value={<InlineMath math={quantity(WOOL, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.readingAfter}
            value={
              <InlineMath
                math={quantity(
                  seal === "open" ? WOOL + oxygen : WOOL,
                  "\\text{ g}",
                  2
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.oxygenJoined}
            value={<InlineMath math={quantity(oxygen, "\\text{ g}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The tuft as one geometry of curling tubes, and for each vertex how far
 * along the burn it sits, from 0 where the battery touches to 1 at the far
 * side.
 */
function createTuft() {
  const strands = Arr.map(Arr.range(0, STRANDS - 1), (strand) => {
    const points = Arr.map(Arr.range(0, STRAND_POINTS - 1), (step) => {
      const along = step / (STRAND_POINTS - 1);
      return new Vector3(
        (along - 0.5) * TUFT.width + (hashUnit(strand, step) - 0.5) * 0.02,
        0.004 + hashUnit(step, strand + 40) * TUFT.height,
        (hashUnit(strand + 80, step) - 0.5) * TUFT.depth
      );
    });
    return new TubeGeometry(new CatmullRomCurve3(points), 48, 0.0007, 5);
  });
  const tuft = mergeGeometries(strands);
  Arr.forEach(strands, (strand) => strand.dispose());
  const position = tuft.getAttribute("position");
  const reach = new Float32Array(position.count);
  for (let index = 0; index < position.count; index += 1) {
    reach[index] = position.getX(index) / TUFT.width + 0.5;
  }
  tuft.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(position.count * 3), 3)
  );
  return { reach, tuft };
}

/** Paints the steel and the glow of every vertex for a burn front at `front`. */
function paintBurn(
  steel: BufferGeometry,
  glow: BufferGeometry,
  reach: Float32Array,
  front: number
) {
  const base = steel.getAttribute("color");
  const light = glow.getAttribute("color");
  const color = new Color();
  for (let index = 0; index < reach.length; index += 1) {
    const behind = front - reach[index];
    color.copy(STEEL).lerp(OXIDE, Math.min(1, Math.max(0, behind * 6)));
    base.setXYZ(index, color.r, color.g, color.b);
    const heat = Math.max(0, 1 - Math.abs(behind) * 9);
    light.setXYZ(index, GLOW.r * heat, GLOW.g * heat, GLOW.b * heat);
  }
  base.needsUpdate = true;
  light.needsUpdate = true;
}

/** The bench, the balance, the tile and the tuft, run by the play clock. */
function WoolScene({ seal }: { readonly seal: Seal }) {
  const scale = useRef<ScaleRig>(null);
  const reading = useReading();
  const { reach, steel, glow } = useMemo(() => {
    const made = createTuft();
    return { glow: made.tuft.clone(), reach: made.reach, steel: made.tuft };
  }, []);
  const { advance, playing } = useTimeline(-1.5, BURN_TIME + 1);

  useEffect(
    () => () => {
      steel.dispose();
      glow.dispose();
    },
    [glow, steel]
  );

  useFrame((_, delta) => {
    const time = advance(delta);
    const burnt = Math.min(1, Math.max(0, time / BURN_TIME));
    const front = time < 0 ? -1 : burnt * 1.15;
    paintBurn(steel, glow, reach, front);
    const gained = seal === "open" ? oxygenTakenBy(WOOL * burnt) : 0;
    scale.current?.show(reading(WOOL + gained, 2));
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <LabBench />
      <Scale ref={scale} unitLabel="g">
        <mesh position={[0, 0.004, 0]} receiveShadow>
          <boxGeometry args={[0.12, 0.008, 0.1]} />
          <meshStandardMaterial color={MATERIAL.ceramicTile} roughness={0.9} />
        </mesh>
        <group position={[0, 0.008, 0]}>
          <mesh castShadow geometry={steel}>
            <meshStandardMaterial
              metalness={0.7}
              roughness={0.45}
              vertexColors
            />
          </mesh>
          <mesh geometry={glow}>
            <meshBasicMaterial
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              transparent
              vertexColors
            />
          </mesh>
        </group>
        {seal === "closed" ? (
          <mesh position={[0, 0.008, 0]}>
            <sphereGeometry
              args={[0.075, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <GlassMaterial color={MATERIAL.glass} opacity={0.2} />
          </mesh>
        ) : null}
      </Scale>
      <group position={[-0.24, 0, 0.05]} rotation={[0, 0.5, 0]}>
        <mesh castShadow position={[0, 0.024, 0]}>
          <boxGeometry args={[0.026, 0.048, 0.017]} />
          <meshStandardMaterial color={MATERIAL.battery} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.02, 0.004, 0.012]} />
          <meshStandardMaterial
            color={MATERIAL.batteryTerminal}
            metalness={1}
            roughness={0.3}
          />
        </mesh>
      </group>
    </>
  );
}
