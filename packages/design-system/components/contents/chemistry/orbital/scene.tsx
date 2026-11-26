import { PointMaterial, Points } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitalId } from "@repo/design-system/components/contents/chemistry/orbital/wave";
import {
  boundaryDensity,
  orbitalReach,
  sampleCloud,
  waveGrid,
} from "@repo/design-system/components/contents/chemistry/orbital/wave";
import {
  useInvalidateOnChange,
  useSimulationClock,
} from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { Axes } from "@repo/design-system/components/three/axes";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Origin } from "@repo/design-system/components/three/origin";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { isMobileDevice } from "@repo/design-system/lib/device";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { Color, DoubleSide, MeshPhysicalMaterial } from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

/** How long one Bohr radius is in the scene, so a 3s cloud stands larger than a 1s one. */
export const BOHR = 0.17;

const CANDIDATES = { desktop: 160_000, phone: 60_000 } as const;
const GLOW = { dark: 1.45, light: 0.96 } as const;
const BOUNDARY_SHARE = 0.9;
const SURFACE_CELLS = { desktop: 72, phone: 48 } as const;
const SURFACE_TRIANGLES = 120_000;
const RING_TICKS = Arr.makeBy(24, (idx) => (idx / 24) * Math.PI * 2);

/** Subtle nodal planes, cones, and radial-node rings showing where psi = 0. */
function NodalGuides({
  id,
  isDarkTheme,
  radius,
}: {
  readonly id: OrbitalId;
  readonly isDarkTheme: boolean;
  readonly radius: number;
}) {
  const discColor = isDarkTheme
    ? getColor("SLATE", 300)
    : getColor("SLATE", 600);
  const rimColor = isDarkTheme ? INSTRUMENT_COLORS.brass : PLOT_COLORS.slate;
  const discR = radius * 0.86;

  return (
    <CameraBounds exclude>
      <group>
        {Match.value(id).pipe(
          Match.when("1s", () => null),
          Match.when("2s", () => (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2 * BOHR, 0.01, 10, 64]} />
              <meshStandardMaterial
                color={rimColor}
                opacity={0.55}
                roughness={0.3}
                transparent
              />
            </mesh>
          )),
          Match.when("3s", () => (
            <group>
              {Arr.map([1.9 * BOHR, 7.1 * BOHR] as const, (r) => (
                <mesh key={r} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[r, 0.011, 10, 72]} />
                  <meshStandardMaterial
                    color={rimColor}
                    opacity={0.52}
                    roughness={0.3}
                    transparent
                  />
                </mesh>
              ))}
            </group>
          )),
          Match.when("2px", () => (
            <group rotation={[0, Math.PI / 2, 0]}>
              <mesh>
                <circleGeometry args={[discR, 56]} />
                <meshPhysicalMaterial
                  clearcoat={0.6}
                  color={discColor}
                  depthWrite={false}
                  opacity={isDarkTheme ? 0.1 : 0.08}
                  roughness={0.25}
                  side={DoubleSide}
                  transparent
                />
              </mesh>
              <mesh>
                <torusGeometry args={[discR, 0.008, 8, 64]} />
                <meshStandardMaterial
                  color={rimColor}
                  opacity={0.45}
                  transparent
                />
              </mesh>
            </group>
          )),
          Match.when("2pz", () => (
            <group>
              <mesh>
                <circleGeometry args={[discR, 56]} />
                <meshPhysicalMaterial
                  clearcoat={0.6}
                  color={discColor}
                  depthWrite={false}
                  opacity={isDarkTheme ? 0.1 : 0.08}
                  roughness={0.25}
                  side={DoubleSide}
                  transparent
                />
              </mesh>
              <mesh>
                <torusGeometry args={[discR, 0.008, 8, 64]} />
                <meshStandardMaterial
                  color={rimColor}
                  opacity={0.45}
                  transparent
                />
              </mesh>
            </group>
          )),
          Match.when("3pz", () => (
            <group>
              <mesh>
                <circleGeometry args={[discR, 56]} />
                <meshPhysicalMaterial
                  clearcoat={0.6}
                  color={discColor}
                  depthWrite={false}
                  opacity={isDarkTheme ? 0.09 : 0.07}
                  roughness={0.25}
                  side={DoubleSide}
                  transparent
                />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[6 * BOHR, 0.011, 10, 72]} />
                <meshStandardMaterial
                  color={rimColor}
                  opacity={0.48}
                  transparent
                />
              </mesh>
            </group>
          )),
          Match.when("3dxy", () => (
            <group>
              {Arr.map(
                [
                  { id: "yz", rot: [0, Math.PI / 2, 0] as const },
                  { id: "xz", rot: [Math.PI / 2, 0, 0] as const },
                ] as const,
                (plane) => (
                  <group key={plane.id} rotation={plane.rot}>
                    <mesh>
                      <circleGeometry args={[discR, 56]} />
                      <meshPhysicalMaterial
                        color={discColor}
                        depthWrite={false}
                        opacity={isDarkTheme ? 0.08 : 0.06}
                        side={DoubleSide}
                        transparent
                      />
                    </mesh>
                    <mesh>
                      <torusGeometry args={[discR, 0.008, 8, 64]} />
                      <meshStandardMaterial
                        color={rimColor}
                        opacity={0.38}
                        transparent
                      />
                    </mesh>
                  </group>
                )
              )}
            </group>
          )),
          Match.when("3dz2", () => (
            <group rotation={[Math.PI / 2, 0, 0]}>
              {Arr.map([-1, 1] as const, (dir) => (
                <mesh
                  key={dir}
                  position={[0, dir * discR * 0.34, 0]}
                  rotation={[dir === 1 ? Math.PI : 0, 0, 0]}
                >
                  <coneGeometry
                    args={[discR * 0.48, discR * 0.68, 48, 1, true]}
                  />
                  <meshPhysicalMaterial
                    color={discColor}
                    depthWrite={false}
                    opacity={isDarkTheme ? 0.1 : 0.08}
                    side={DoubleSide}
                    transparent
                  />
                </mesh>
              ))}
            </group>
          )),
          Match.exhaustive
        )}
      </group>
    </CameraBounds>
  );
}

/** Graduated equatorial Bohr-radius reference dial framing the quantum probability cloud. */
function BohrReferenceRing({ radius }: { readonly radius: number }) {
  const ringR = radius * 0.98;
  return (
    <CameraBounds exclude>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <torusGeometry args={[ringR, 0.009, 12, 96]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.32} />
        </mesh>
        {Arr.map(RING_TICKS, (ang, idx) => {
          const major = idx % 6 === 0;
          return (
            <mesh
              key={ang}
              position={[Math.cos(ang) * ringR, Math.sin(ang) * ringR, 0]}
              rotation={[0, 0, ang]}
            >
              <boxGeometry
                args={[
                  major ? 0.075 : 0.038,
                  major ? 0.016 : 0.01,
                  major ? 0.016 : 0.01,
                ]}
              />
              <MetalMaterial
                color={
                  major ? INSTRUMENT_COLORS.brass : INSTRUMENT_COLORS.aluminium
                }
                roughness={0.28}
              />
            </mesh>
          );
        })}
      </group>
    </CameraBounds>
  );
}

/**
 * Glossy translucent marching-cubes 90% boundary surface per wave-function sign,
 * rich internal probability point cloud, nodal plane/cone guides, and glowing nucleus.
 */
export function OrbitalCloud({ id }: { readonly id: OrbitalId }) {
  useInvalidateOnChange(id);
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";
  const phone = isMobileDevice();
  const cells = phone ? SURFACE_CELLS.phone : SURFACE_CELLS.desktop;
  const cloudGroupRef = useRef<Group>(null);
  const { advance, playing } = useSimulationClock(0);

  const reachUnits = orbitalReach(id) * BOHR;

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

  useFrame((_, delta) => {
    const t = advance(delta);
    if (cloudGroupRef.current !== null) {
      cloudGroupRef.current.rotation.y = t * 0.28;
      const breathe = 1 + Math.sin(t * 1.4) * 0.018;
      cloudGroupRef.current.scale.setScalar(breathe);
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <BohrReferenceRing radius={reachUnits} />
      <group ref={cloudGroupRef}>
        <NodalGuides id={id} isDarkTheme={isDarkTheme} radius={reachUnits} />
        {Arr.map(surface, (lobe) => (
          <OrbitalLobe
            cells={cells}
            color={lobe.color}
            field={lobe.field}
            isDarkTheme={isDarkTheme}
            key={`${id}-${lobe.color}`}
            level={lobe.level}
            size={reachUnits}
          />
        ))}
        <Points
          colors={geometry.colors}
          key={id}
          positions={geometry.positions}
        >
          <PointMaterial
            depthWrite={false}
            opacity={isDarkTheme ? 0.68 : 0.72}
            size={0.036}
            sizeAttenuation
            toneMapped={false}
            transparent
            vertexColors
          />
        </Points>
        {/* Multi-layered luminous quantum nucleus */}
        <mesh>
          <sphereGeometry args={[0.052, 28, 20]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={isDarkTheme ? getColor("WHITE") : PLOT_COLORS.amber}
            emissive={isDarkTheme ? getColor("WHITE") : PLOT_COLORS.amber}
            emissiveIntensity={isDarkTheme ? 2.6 : 1.1}
            roughness={0.14}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.095, 24, 18]} />
          <meshStandardMaterial
            color={PLOT_COLORS.amber}
            depthWrite={false}
            emissive={PLOT_COLORS.amber}
            emissiveIntensity={isDarkTheme ? 0.9 : 0.35}
            opacity={isDarkTheme ? 0.28 : 0.18}
            transparent
          />
        </mesh>
      </group>
    </group>
  );
}

function OrbitalLobe({
  cells,
  color,
  field,
  isDarkTheme,
  level,
  size,
}: {
  readonly cells: number;
  readonly color: string;
  readonly field: Float32Array;
  readonly isDarkTheme: boolean;
  readonly level: number;
  readonly size: number;
}) {
  const shell = useMemo(() => {
    const cubes = new MarchingCubes(
      cells,
      new MeshPhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        color,
        depthWrite: false,
        envMapIntensity: 1.5,
        ior: 1.48,
        metalness: 0.04,
        opacity: isDarkTheme ? 0.46 : 0.42,
        reflectivity: 0.95,
        roughness: 0.1,
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
  }, [cells, color, field, isDarkTheme, level]);

  useEffect(
    () => () => {
      shell.geometry.dispose();
      Arr.map(Arr.ensure(shell.material), (material) => material.dispose());
    },
    [shell]
  );

  return <primitive object={shell} scale={size} />;
}

/** Unbounded Cartesian coordinate axes through the nucleus (`Axes`). */
export function OrbitalAxes() {
  return (
    <CameraBounds exclude>
      <Axes reach={100} showLabels showZAxis />
      <Origin color={PLOT_COLORS.slate} size={0.05} />
    </CameraBounds>
  );
}

/** Frames the widest offered cloud from slightly above, farther back on a narrow card. */
export function OrbitalCamera({ reach }: { readonly reach: number }) {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = reach * (narrow ? 3.4 : 2.75);
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
