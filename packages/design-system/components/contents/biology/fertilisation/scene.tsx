import { useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useRunClock } from "@repo/design-system/components/contents/biology/clock";
import {
  seedChromosomes,
  stageAt,
  stageProgress,
} from "@repo/design-system/components/contents/biology/fertilisation/gametes";
import { leafSurface } from "@repo/design-system/components/contents/biology/leaf";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { type ReactNode, useEffect, useMemo } from "react";
import {
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  Float32BufferAttribute,
  Quaternion,
  Vector2,
  Vector3,
} from "three";

/** A point of the flower, in centimetres. */
type Point = readonly [number, number, number];

/** The middle of the ovule whose embryo sac the lab follows, and its micropyle above it. */
const OVULE: Point = [0, 1.4, 0.05];
const MICROPYLE: Point = [0, 2.2, 0.05];

/** Where the pollen grain lands on the stigma. */
const STIGMA: Point = [0.12, 5.35, 0.12];

/** The run lasts this long, as a share; the card plays it in this many seconds. */
const RUN_SECONDS = 9;

/** The path the pollen tube grows: down through the style, across the ovary, into the micropyle. */
const TUBE_PATH: readonly Point[] = [
  STIGMA,
  [0.06, 4.6, 0.08],
  [0.02, 3.6, 0.06],
  [0.08, 2.75, 0.1],
  [0.3, 2.5, 0.12],
  MICROPYLE,
];

/** The ovary's wall, turned half round its axis so the cut shows its inside. */
const OVARY_WALL = [
  [0.0, 0.25],
  [0.85, 0.45],
  [1.25, 1.1],
  [1.2, 1.9],
  [0.75, 2.5],
  [0.22, 2.75],
] as const;

/**
 * A flower cut lengthwise: petals and stamens round an ovary opened to show
 * its ovules, the style above it and the stigma on top. One pollen grain on
 * the stigma grows a tube down the style into an ovule's micropyle; of its
 * two male gametes, one fuses with the egg to make the zygote and the other
 * with the two polar nuclei to make the endosperm nucleus. Each nucleus
 * carries its chromosome count.
 */
export function FertilisationScene({
  elapsed,
  father,
  mother,
  onElapsed,
}: {
  readonly elapsed: number;
  readonly father: number;
  readonly mother: number;
  readonly onElapsed: (progress: number) => void;
}) {
  useRunClock({
    elapsed,
    onElapsed,
    perSecond: 1 / RUN_SECONDS,
    steps: 90,
    total: 1,
  });
  const stage = stageAt(elapsed);
  const counts = seedChromosomes(mother, father);
  const tube = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(TUBE_PATH, (point) => new Vector3(...point))
      ),
    []
  );
  // Each stage's share of the run is 0 before it starts and 1 once it ends.
  const grown = stageProgress("tube", elapsed);
  const tip = tube.getPointAt(Math.max(0.001, grown * 0.999));
  const entering = stage === "entry" ? stageProgress("entry", elapsed) : 0;
  const fused = stageProgress("fusion", elapsed);
  const egg: Point = [OVULE[0] - 0.12, OVULE[1] + 0.46, OVULE[2] + 0.1];
  const polar: Point = [OVULE[0], OVULE[1], OVULE[2] + 0.1];
  const spermPosition = (target: Point, lead: number): Point => {
    if (stage === "fusion") {
      return [
        tip.x + (target[0] - tip.x) * Math.min(1, fused * 2),
        tip.y + (target[1] - tip.y) * Math.min(1, fused * 2),
        tip.z + (target[2] - tip.z) * Math.min(1, fused * 2),
      ];
    }
    const back = tube.getPointAt(
      Math.max(0.001, grown * 0.999 - lead * (1 - entering))
    );
    return [back.x, back.y, back.z];
  };
  const done = fused >= 0.5;

  return (
    <group>
      <FlowerCamera />
      <Flower />
      <Ovules />
      <mesh>
        <tubeGeometry args={[tube, 120, 0.035, 8, false]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.pollenTube}
          opacity={grown > 0 ? 0.95 : 0}
          roughness={0.5}
          transparent
        />
      </mesh>
      <PollenGrain />
      {grown > 0 && (
        <mesh position={tip}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.pollenTube}
            roughness={0.5}
          />
        </mesh>
      )}
      {stage !== "pollination" && !done && (
        <>
          <Nucleus
            color={BIOLOGY_COLORS.spermNucleus}
            position={spermPosition(egg, 0.02)}
            size={0.08}
          >
            <CountTag count={counts.sperm} reach={0.08} side="left" />
          </Nucleus>
          <Nucleus
            color={BIOLOGY_COLORS.spermNucleus}
            position={spermPosition(polar, 0.05)}
            size={0.08}
          >
            <CountTag count={counts.sperm} reach={0.08} side="right" />
          </Nucleus>
        </>
      )}
      {done ? (
        <>
          <Nucleus color={BIOLOGY_COLORS.zygote} position={egg} size={0.15}>
            <CountTag count={counts.embryo} reach={0.15} side="left" />
          </Nucleus>
          <Nucleus
            color={BIOLOGY_COLORS.endosperm}
            position={polar}
            size={0.18}
          >
            <CountTag count={counts.endosperm} reach={0.18} side="right" />
          </Nucleus>
        </>
      ) : (
        <>
          <Nucleus color={BIOLOGY_COLORS.eggNucleus} position={egg} size={0.13}>
            <CountTag count={counts.egg} reach={0.13} side="left" />
          </Nucleus>
          <Nucleus
            color={BIOLOGY_COLORS.polarNucleus}
            position={[polar[0] - 0.13, polar[1], polar[2]]}
            size={0.1}
          />
          <Nucleus
            color={BIOLOGY_COLORS.polarNucleus}
            position={[polar[0] + 0.13, polar[1] - 0.12, polar[2]]}
            size={0.1}
          >
            <CountTag count={counts.egg} pair reach={0.1} side="right" />
          </Nucleus>
        </>
      )}
      <SeedCoatTag count={counts.seedCoat} />
    </group>
  );
}

/** A nucleus as a soft sphere, with the count it carries beside it. */
function Nucleus({
  children,
  color,
  position,
  size,
}: {
  readonly children?: ReactNode;
  readonly color: string;
  readonly position: Point;
  readonly size: number;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[size, 20, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.4}
        />
      </mesh>
      {children}
    </group>
  );
}

/**
 * A nucleus's chromosome count, on the side of it away from its neighbours:
 * the egg's line on the left and the polar nuclei's on the right, so the
 * counts of nuclei a few pixels apart on a phone never run together. The two
 * polar nuclei share one count that names both.
 */
function CountTag({
  count,
  pair = false,
  reach,
  side,
}: {
  readonly count: number;
  readonly pair?: boolean;
  readonly reach: number;
  readonly side: "left" | "right";
}) {
  const ink = useLabelInk();
  return (
    <ThreeLabel
      anchorX={side === "left" ? "right" : "left"}
      color={ink}
      fontSize="compact"
      gap={reach + 0.06}
      position={[0, 0, 0.08]}
    >
      <InlineMath math={pair ? `${count} + ${count}` : String(count)} />
    </ThreeLabel>
  );
}

/** The seed coat's count, on the ovule's outer integument, the mother's own unfertilised tissue. */
function SeedCoatTag({ count }: { readonly count: number }) {
  const ink = useLabelInk();
  const quantity = useQuantity();
  return (
    <ThreeLabel
      color={ink}
      fontSize="compact"
      position={[OVULE[0] - 0.62, OVULE[1] - 0.45, OVULE[2] + 0.2]}
    >
      <InlineMath math={quantity(count, "", 0)} />
    </ThreeLabel>
  );
}

/** The flower's receptacle, opened ovary, style, stigma, petals and stamens. */
function Flower() {
  const ovary = useMemo(
    () => Arr.map(OVARY_WALL, ([r, y]) => new Vector2(r, y)),
    []
  );
  const blade = useMemo(() => {
    const surface = leafSurface({
      columns: 12,
      droop: -0.18,
      length: 1,
      rows: 20,
      width: 0.62,
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(surface.positions, 3)
    );
    geometry.setIndex(surface.indices);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => blade.dispose(), [blade]);
  return (
    <group>
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 2.6, 16]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.stem} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.15, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.6, 28, 16]} />
        <meshStandardMaterial
          color={BIOLOGY_COLORS.receptacle}
          roughness={0.6}
        />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <latheGeometry args={[ovary, 40, 0, Math.PI]} />
        <meshPhysicalMaterial
          color={BIOLOGY_COLORS.ovary}
          roughness={0.55}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, 4.05, 0]}>
        <cylinderGeometry
          args={[0.14, 0.22, 2.7, 20, 1, true, Math.PI / 2, Math.PI]}
        />
        <meshPhysicalMaterial
          color={BIOLOGY_COLORS.ovary}
          opacity={0.55}
          roughness={0.5}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {Arr.map(Arr.range(0, 4), (lobe) => (
        <mesh
          key={lobe}
          position={[
            Math.cos(lobe * 1.6) * 0.16,
            5.45,
            Math.sin(lobe * 1.6) * 0.16,
          ]}
        >
          <sphereGeometry args={[0.2, 16, 12]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.stigma}
            roughness={0.85}
          />
        </mesh>
      ))}
      {Arr.map(Arr.range(0, 5), (petal) => (
        <group
          key={petal}
          position={[0, 0.25, 0]}
          rotation={[0, Math.PI * 0.06 + petal * (Math.PI * 0.22), 0]}
        >
          <mesh
            geometry={blade}
            position={[0.85, 0, 0]}
            rotation={[0, 0, 0.85]}
            scale={[3, 3, 3]}
          >
            <meshPhysicalMaterial
              color={BIOLOGY_COLORS.petal}
              roughness={0.45}
              side={DoubleSide}
            />
          </mesh>
        </group>
      ))}
      {Arr.map(Arr.range(0, 4), (stamen) => {
        const angle = -Math.PI * 0.45 + stamen * (Math.PI * 0.3);
        const base = new Vector3(
          Math.sin(angle) * 1.0,
          0.35,
          -Math.cos(angle) * 1.0
        );
        const top = new Vector3(
          Math.sin(angle) * 1.75,
          3.3,
          -Math.cos(angle) * 1.5
        );
        const middle = base.clone().add(top).multiplyScalar(0.5);
        return (
          <group key={stamen}>
            <mesh
              position={middle}
              quaternion={new Quaternion().setFromUnitVectors(
                new Vector3(0, 1, 0),
                top.clone().sub(base).normalize()
              )}
            >
              <cylinderGeometry args={[0.035, 0.04, base.distanceTo(top), 8]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.filament}
                roughness={0.6}
              />
            </mesh>
            <mesh position={top} scale={[0.6, 1, 0.6]}>
              <capsuleGeometry args={[0.12, 0.3, 6, 12]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.anther}
                roughness={0.7}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** The ovules on the ovary's placenta; the middle one is cut to show its integuments and embryo sac. */
function Ovules() {
  return (
    <group>
      {Arr.map([-0.78, 0.78] as const, (x) => (
        <mesh key={x} position={[x, 1.25, -0.35]} scale={[0.7, 1, 0.7]}>
          <sphereGeometry args={[0.36, 20, 14]} />
          <meshStandardMaterial color={BIOLOGY_COLORS.ovule} roughness={0.5} />
        </mesh>
      ))}
      <mesh
        position={OVULE}
        rotation={[0, Math.PI / 2, 0]}
        scale={[0.8, 1.15, 0.8]}
      >
        <sphereGeometry args={[0.7, 32, 20, 0, Math.PI, 0.3, Math.PI - 0.3]} />
        <meshPhysicalMaterial
          color={BIOLOGY_COLORS.ovule}
          roughness={0.45}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={OVULE} scale={[0.55, 1, 0.3]}>
        <sphereGeometry args={[0.62, 28, 18]} />
        <meshPhysicalMaterial
          color={BIOLOGY_COLORS.embryoSac}
          opacity={0.75}
          roughness={0.4}
          transparent
        />
      </mesh>
      {Arr.map([-0.1, 0.1] as const, (x) => (
        <mesh
          key={x}
          position={[OVULE[0] + x * 1.6, OVULE[1] + 0.48, OVULE[2] + 0.06]}
        >
          <sphereGeometry args={[0.07, 12, 10]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.synergid}
            roughness={0.5}
          />
        </mesh>
      ))}
      {Arr.map([-0.09, 0, 0.09] as const, (x) => (
        <mesh
          key={x}
          position={[OVULE[0] + x * 1.5, OVULE[1] - 0.48, OVULE[2] + 0.06]}
        >
          <sphereGeometry args={[0.065, 12, 10]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.synergid}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

/** The pollen grain on the stigma: a ball sculpted with tiny spines. */
function PollenGrain() {
  return (
    <group position={STIGMA}>
      <mesh>
        <icosahedronGeometry args={[0.11, 2]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.pollen} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Looks at the cut flower from the front and a little to one side, farther back on a narrow card. */
function FlowerCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 13.5 : 10.2;
  return (
    <CameraControls
      cameraPosition={[distance * 0.18, 3.2, distance]}
      cameraTarget={[0, 2.6, 0]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={2}
    />
  );
}
