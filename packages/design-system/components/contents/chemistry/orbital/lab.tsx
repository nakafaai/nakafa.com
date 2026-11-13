import { Line, PointMaterial, Points } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  type OrbitalId,
  OrbitalIdSchema,
  orbitalNumbers,
  orbitalReach,
  radialNodes,
  sampleCloud,
} from "@repo/design-system/components/contents/chemistry/orbital/wave";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
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
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { isMobileDevice } from "@repo/design-system/lib/device";
import { AXIS_COLORS, PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import { type ReactNode, Suspense, useMemo, useState } from "react";
import { Color } from "three";

/** How long one Bohr radius is in the scene, so a 3s cloud stands larger than a 1s one. */
const BOHR = 0.17;

/** How many candidate points a cloud is sampled from, by device. */
const CANDIDATES = { desktop: 320_000, phone: 110_000 } as const;

/** How much brighter than white a cloud's points glow, so the finish's bloom catches them. */
const GLOW = 1.8;

/** The words an orbital lab reads from its lesson. */
type OrbitalLabels = {
  /** The name of the toggle that chooses an orbital, for assistive technology. */
  readonly choose: string;
  /** The readout of the quantum numbers. */
  readonly numbers: ReactNode;
  /** The readout of the orbital's name. */
  readonly orbital: ReactNode;
  /** The readout of the spheres where the cloud vanishes. */
  readonly radial: ReactNode;
  /** The readout of the planes and cones where the cloud vanishes. */
  readonly angular: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
};

/**
 * An orbital lab: the electron cloud of a hydrogen orbital, thousands of
 * points crowding where the electron is most likely to be found, sampled from
 * the real wave function. Lobes of one sign glow amber and of the other
 * violet, so the nodal planes between them read at a glance, and a larger
 * shell stands larger. The footer reads the orbital, its quantum numbers, and
 * how many radial and angular nodes it has.
 *
 * @param orbitals - The orbitals to offer, in order
 */
export function OrbitalCloudLab({
  description,
  labels,
  orbitals,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: OrbitalLabels;
  readonly orbitals: readonly OrbitalId[];
  readonly title: ReactNode;
}) {
  const offered = Arr.filter(orbitals, (id) => Schema.is(OrbitalIdSchema)(id));
  const [chosen, setChosen] = useState<OrbitalId | undefined>(undefined);
  const shown = Arr.findFirst(offered, (id) => id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const { l, n, tex } = orbitalNumbers(shown);
  const widest = Arr.reduce(offered, 0, (reach, id) =>
    Math.max(reach, orbitalReach(id) * BOHR)
  );

  function choose(value: string) {
    if (Schema.is(OrbitalIdSchema)(value)) {
      setChosen(value);
    }
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {offered.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.choose}
            gridColumns={offered.length > 3 ? "4" : "3"}
            onValueChange={choose}
            type="single"
            value={shown}
            variant="outline"
          >
            {Arr.map(offered, (id) => (
              <ToggleGroupItem
                aria-label={orbitalNumbers(id).tex}
                key={id}
                value={id}
              >
                <InlineMath math={orbitalNumbers(id).tex} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={`${labels.view}: ${tex}`}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={widest + 0.5} setting="space">
          <Suspense>
            <OrbitalCamera reach={widest} />
            <OrbitalCloud id={shown} />
            <OrbitalAxes reach={widest} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.orbital} value={<InlineMath math={tex} />} />
          <VisualFact
            label={labels.numbers}
            value={<InlineMath math={`n = ${n},\\ \\ell = ${l}`} />}
          />
          <VisualFact
            label={labels.radial}
            value={<InlineMath math={`${radialNodes(shown)}`} />}
          />
          <VisualFact
            label={labels.angular}
            value={<InlineMath math={`${l}`} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The cloud itself: every sampled point at its place, glowing in the color of
 * its lobe's sign, around a small bright nucleus.
 */
function OrbitalCloud({ id }: { readonly id: OrbitalId }) {
  const geometry = useMemo(() => {
    const cloud = sampleCloud(
      id,
      isMobileDevice() ? CANDIDATES.phone : CANDIDATES.desktop
    );
    const plus = new Color(PLOT_COLORS.amber).multiplyScalar(GLOW);
    const minus = new Color(PLOT_COLORS.violet).multiplyScalar(GLOW);
    return {
      colors: Float32Array.from(
        Arr.flatMap(cloud, (point) =>
          (point.phase === 1 ? plus : minus).toArray()
        )
      ),
      positions: Float32Array.from(
        Arr.flatMap(cloud, (point) =>
          Arr.map(point.position, (coordinate) => coordinate * BOHR)
        )
      ),
    };
  }, [id]);

  return (
    <group>
      <Points
        colors={geometry.colors}
        key={id}
        positions={geometry.positions}
      >
        <PointMaterial
          depthWrite={false}
          opacity={0.75}
          size={0.026}
          sizeAttenuation
          toneMapped={false}
          transparent
          vertexColors
        />
      </Points>
      <mesh>
        <sphereGeometry args={[0.035, 24, 16]} />
        <meshStandardMaterial
          color={getColor("WHITE")}
          emissive={getColor("WHITE")}
          emissiveIntensity={3}
        />
      </mesh>
    </group>
  );
}

/** Three faint axes through the nucleus, x red, y green, z blue, to read a lobe's direction. */
function OrbitalAxes({ reach }: { readonly reach: number }) {
  const axes = [
    { color: AXIS_COLORS.x, end: [reach, 0, 0], name: "x" },
    { color: AXIS_COLORS.y, end: [0, reach, 0], name: "y" },
    { color: AXIS_COLORS.z, end: [0, 0, reach], name: "z" },
  ] as const;

  return (
    <group>
      {Arr.map(axes, (axis) => (
        <group key={axis.name}>
          <Line
            color={axis.color}
            lineWidth={0.8}
            opacity={0.3}
            points={[
              [-axis.end[0], -axis.end[1], -axis.end[2]],
              [axis.end[0], axis.end[1], axis.end[2]],
            ]}
            transparent
          />
          <ThreeLabel color={axis.color} fontSize="compact" position={axis.end}>
            <InlineMath math={axis.name} />
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}

/** Frames the widest offered cloud from slightly above, farther back on a narrow card. */
function OrbitalCamera({ reach }: { readonly reach: number }) {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = reach * (narrow ? 3.4 : 2.7);
  return (
    <CameraControls
      cameraPosition={[distance * 0.55, distance * 0.35, distance * 0.76]}
      cameraTarget={[0, 0, 0]}
      fov={40}
      maxDistance={distance * 2}
      minDistance={reach * 0.6}
    />
  );
}
