import { PointMaterial, Points } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { OrbitalId } from "@repo/design-system/components/contents/chemistry/orbital/wave";
import {
  boundaryDensity,
  OrbitalIdSchema,
  orbitalNumbers,
  orbitalReach,
  radialNodes,
  sampleCloud,
  waveGrid,
} from "@repo/design-system/components/contents/chemistry/orbital/wave";
import { useInvalidateOnChange } from "@repo/design-system/components/contents/simulation/clock";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Axes } from "@repo/design-system/components/three/axes";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Origin } from "@repo/design-system/components/three/origin";
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
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr, Option, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Color, DoubleSide, MeshPhysicalMaterial } from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

/** How long one Bohr radius is in the scene, so a 3s cloud stands larger than a 1s one. */
const BOHR = 0.17;

/** How many candidate points the faint cloud inside the surface is sampled from, by device. */
const CANDIDATES = { desktop: 160_000, phone: 60_000 } as const;

/** How much brighter than base color a cloud's points glow in each theme. */
const GLOW = { dark: 1.35, light: 0.92 } as const;

/** The share of the electron's probability the drawn surface holds, as chemistry books draw an orbital. */
const BOUNDARY_SHARE = 0.9;

/** How many grid cells a side the boundary surface is traced through, by device. */
const SURFACE_CELLS = { desktop: 72, phone: 48 } as const;

/** The most triangles one lobe's surface may take, enough for a d lobe at the finest grid. */
const SURFACE_TRIANGLES = 120_000;

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
        <ScienceStage reach={widest + 0.8} setting="studio">
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
  useInvalidateOnChange(id);
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";
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
  const glow = isDarkTheme ? GLOW.dark : GLOW.light;
  const geometry = useMemo(() => {
    const cloud = sampleCloud(
      id,
      phone ? CANDIDATES.phone : CANDIDATES.desktop
    );
    const plus = new Color(PLOT_COLORS.amber).multiplyScalar(glow);
    const minus = new Color(PLOT_COLORS.violet).multiplyScalar(glow);
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
  }, [glow, id, phone]);

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
          opacity={isDarkTheme ? 0.42 : 0.48}
          size={0.02}
          sizeAttenuation
          toneMapped={false}
          transparent
          vertexColors
        />
      </Points>
      <mesh>
        <sphereGeometry args={[0.045, 28, 20]} />
        <meshStandardMaterial
          color={isDarkTheme ? getColor("WHITE") : getColor("SLATE", 800)}
          emissive={isDarkTheme ? getColor("WHITE") : PLOT_COLORS.amber}
          emissiveIntensity={isDarkTheme ? 2.4 : 0.6}
          roughness={0.2}
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
        clearcoatRoughness: 0.06,
        color,
        depthWrite: false,
        envMapIntensity: 1.35,
        metalness: 0.04,
        opacity: 0.6,
        roughness: 0.14,
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

/**
 * Shared Cartesian coordinate axes through the nucleus (`Axes`), with
 * directional cones at the orbital's outer reach and a faint equatorial ring
 * so nodal planes and lobe alignment read clearly from any angle.
 */
function OrbitalAxes({ reach }: { readonly reach: number }) {
  const tipDistance = reach * 0.96;
  const coneRadius = Math.max(0.032, reach * 0.018);
  const coneHeight = coneRadius * 3.1;
  const tips = [
    {
      color: AXIS_COLORS.x,
      name: "x",
      position: [tipDistance, 0, 0] as const,
      rotation: [0, 0, -Math.PI / 2] as const,
    },
    {
      color: AXIS_COLORS.y,
      name: "y",
      position: [0, tipDistance, 0] as const,
      rotation: [0, 0, 0] as const,
    },
    {
      color: AXIS_COLORS.z,
      name: "z",
      position: [0, 0, tipDistance] as const,
      rotation: [Math.PI / 2, 0, 0] as const,
    },
  ] as const;

  return (
    <CameraBounds exclude>
      <Axes reach={Math.max(reach * 1.25, 3.2)} showLabels showZAxis />
      <Origin color={PLOT_COLORS.slate} size={0.05} />
      {Arr.map(tips, (tip) => (
        <mesh key={tip.name} position={tip.position} rotation={tip.rotation}>
          <coneGeometry args={[coneRadius, coneHeight, 20]} />
          <meshStandardMaterial
            color={tip.color}
            roughness={0.32}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[reach * 0.85, 0.006, 12, 96]} />
        <meshBasicMaterial
          color={PLOT_COLORS.slate}
          depthWrite={false}
          opacity={0.18}
          transparent
        />
      </mesh>
    </CameraBounds>
  );
}

/** Frames the widest offered cloud from slightly above, farther back on a narrow card. */
function OrbitalCamera({ reach }: { readonly reach: number }) {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = reach * (narrow ? 3.6 : 2.95);
  return (
    <CameraControls
      cameraPosition={[distance * 0.56, distance * 0.36, distance * 0.74]}
      cameraTarget={[0, 0, 0]}
      fov={40}
      maxDistance={distance * 2.2}
      minDistance={reach * 0.65}
      orbitOnPlay
    />
  );
}
