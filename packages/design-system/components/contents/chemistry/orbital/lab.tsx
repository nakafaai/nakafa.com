import { Line, PointMaterial, Points } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { toggleColumns } from "@repo/design-system/components/contents/chemistry/columns";
import {
  boundaryDensity,
  type OrbitalId,
  OrbitalIdSchema,
  orbitalNumbers,
  orbitalReach,
  radialNodes,
  sampleCloud,
  waveGrid,
} from "@repo/design-system/components/contents/chemistry/orbital/wave";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
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
import { type ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { Color, DoubleSide, MeshPhysicalMaterial } from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

/** How long one Bohr radius is in the scene, so a 3s cloud stands larger than a 1s one. */
const BOHR = 0.17;

/** How many candidate points the faint cloud inside the surface is sampled from, by device. */
const CANDIDATES = { desktop: 160_000, phone: 60_000 } as const;

/** How much brighter than white a cloud's points glow, so the finish's bloom catches them. */
const GLOW = 1.4;

/** The share of the electron's probability the drawn surface holds, as chemistry books draw an orbital. */
const BOUNDARY_SHARE = 0.9;

/** How many grid cells a side the boundary surface is traced through, by device. */
const SURFACE_CELLS = { desktop: 64, phone: 44 } as const;

/** The most triangles one lobe's surface may take, enough for a d lobe at the finest grid. */
const SURFACE_TRIANGLES = 80_000;

/** The words an orbital lab reads from its lesson. */
interface OrbitalLabels {
  /** The readout of the planes and cones where the cloud vanishes. */
  readonly angular: ReactNode;
  /** The name of the toggle that chooses an orbital, for assistive technology. */
  readonly choose: string;
  /** The readout of the quantum numbers. */
  readonly numbers: ReactNode;
  /** The readout of the orbital's name. */
  readonly orbital: ReactNode;
  /** The readout of the spheres where the cloud vanishes. */
  readonly radial: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

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
  readonly description: NonNullable<ReactNode>;
  readonly labels: OrbitalLabels;
  readonly orbitals: readonly OrbitalId[];
  readonly title: NonNullable<ReactNode>;
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
            gridColumns={toggleColumns(offered.length)}
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
          <VisualFact
            label={labels.orbital}
            value={<InlineMath math={tex} />}
          />
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
 * An orbital as chemistry books and molecular software draw it: the surface
 * that holds 90% of the electron's probability, one glossy translucent shell
 * per sign of the wave function, over a faint cloud of sampled points that
 * shows where the electron is most likely found, around a small bright
 * nucleus.
 */
function OrbitalCloud({ id }: { readonly id: OrbitalId }) {
  const phone = isMobileDevice();
  const cells = phone ? SURFACE_CELLS.phone : SURFACE_CELLS.desktop;
  const surface = useMemo(() => {
    const wave = waveGrid(id, cells);
    const level = boundaryDensity(wave, BOUNDARY_SHARE);
    return Arr.map(
      [
        { color: PLOT_COLORS.amber, phase: 1 },
        { color: PLOT_COLORS.violet, phase: -1 },
      ] as const,
      (lobe) => ({
        color: lobe.color,
        field: Float32Array.from(wave, (value) =>
          value * lobe.phase > 0 ? value * value : 0
        ),
        level,
      })
    );
  }, [cells, id]);
  const geometry = useMemo(() => {
    const cloud = sampleCloud(
      id,
      phone ? CANDIDATES.phone : CANDIDATES.desktop
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
  }, [id, phone]);

  return (
    <group>
      {Arr.map(surface, (lobe) => (
        <OrbitalLobe
          cells={cells}
          color={lobe.color}
          field={lobe.field}
          key={`${id}-${lobe.color}`}
          level={lobe.level}
          size={orbitalReach(id) * BOHR}
        />
      ))}
      <Points colors={geometry.colors} key={id} positions={geometry.positions}>
        <PointMaterial
          depthWrite={false}
          opacity={0.35}
          size={0.018}
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

/**
 * One lobe sign's boundary surface, traced once by marching cubes through
 * the density of that sign, at the level that holds 90% of the probability,
 * and drawn as glossy translucent glass so the cloud inside still shows.
 */
function OrbitalLobe({
  cells,
  color,
  field,
  level,
  size,
}: {
  readonly cells: number;
  readonly color: string;
  readonly field: Float32Array;
  readonly level: number;
  readonly size: number;
}) {
  const shell = useMemo(() => {
    const cubes = new MarchingCubes(
      cells,
      new MeshPhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        color,
        depthWrite: false,
        opacity: 0.5,
        roughness: 0.18,
        side: DoubleSide,
        transparent: true,
      }),
      false,
      false,
      SURFACE_TRIANGLES
    );
    cubes.field.set(field);
    cubes.isolation = level;
    cubes.update();
    return cubes;
  }, [cells, color, field, level]);

  useEffect(
    () => () => {
      shell.geometry.dispose();
      Arr.map(Arr.ensure(shell.material), (material) => material.dispose());
    },
    [shell]
  );

  return <primitive object={shell} scale={size} />;
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
          <ThreeLabel
            color={axis.color}
            fontSize="compact"
            outlineColor={ORIGIN_COLOR.DARK}
            outlineWidth={0.03}
            position={axis.end}
          >
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
