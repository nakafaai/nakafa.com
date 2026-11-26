import { useFrame, useThree } from "@react-three/fiber";
import type { ActivityState } from "@repo/design-system/components/contents/biology/alveolus/model";
import { evaluateAlveolusExchange } from "@repo/design-system/components/contents/biology/alveolus/model";
import { erythrocyteOutline } from "@repo/design-system/components/contents/biology/capillary/erythrocyte";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  LatheGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

const O2_SLOTS = [0, 1, 2, 3, 4] as const;
const RBC_SLOTS = [0.14, 0.34, 0.54, 0.74, 0.9] as const;

/** Neighboring alveoli clustered into a grape-like alveolar acinus behind the hero cutaway sac. */
const ACINUS_SACS = [
  { id: "a1", pos: [-0.66, 0.88, -0.26] as const, r: 0.28 },
  { id: "a2", pos: [-0.72, 0.44, -0.18] as const, r: 0.25 },
  { id: "a3", pos: [-0.38, 0.24, -0.34] as const, r: 0.24 },
  { id: "a4", pos: [-0.46, 1.06, -0.12] as const, r: 0.26 },
  { id: "a5", pos: [-0.04, 1.04, -0.32] as const, r: 0.23 },
  { id: "a6", pos: [-0.58, 0.66, -0.44] as const, r: 0.27 },
] as const;

/** Sculpted cutaway alveolar sac exposing concave lumen and moist surfactant lining. */
function useCutawayAlveolus() {
  const { inner, outer } = useMemo(() => {
    const buildShell = (radius: number) => {
      const geom = new SphereGeometry(
        radius,
        48,
        36,
        Math.PI * 0.16,
        Math.PI * 1.54,
        0,
        Math.PI
      );
      const pos = geom.getAttribute("position");
      for (let i = 0; i < pos.count; i += 1) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const n =
          1 + 0.045 * (valueNoise(vx * 7 + 2, vy * 7 + vz * 5, 32) - 0.5);
        pos.setXYZ(i, vx * n, vy * n, vz * n);
      }
      geom.computeVertexNormals();
      return geom;
    };
    return { inner: buildShell(0.92), outer: buildShell(1) };
  }, []);
  useEffect(
    () => () => {
      outer.dispose();
      inner.dispose();
    },
    [inner, outer]
  );
  return { inner, outer };
}

/** True Evans-Fung biconcave erythrocyte disc via LatheGeometry. */
function useBiconcaveRbc() {
  const geometry = useMemo(() => {
    const pts = Arr.map(
      erythrocyteOutline(16),
      ([r, h]) => new Vector2(r * 0.022, h * 0.022)
    );
    const geom = new LatheGeometry(pts, 28);
    geom.computeVertexNormals();
    return geom;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Vertex-colored pulmonary capillary network transitioning from venous blue-plum to arterial crimson. */
function useCapillaryNetwork(highAltitude: boolean) {
  const network = useMemo(() => {
    const mainCurve = new CatmullRomCurve3([
      new Vector3(0.42, 0.04, 0.08),
      new Vector3(0.68, 0.26, 0.18),
      new Vector3(0.56, 0.58, 0.24),
      new Vector3(0.66, 0.92, 0.16),
      new Vector3(0.4, 1.18, 0.04),
    ]);
    const branchCurve = new CatmullRomCurve3([
      new Vector3(0.66, 0.28, 0.16),
      new Vector3(0.28, 0.48, 0.42),
      new Vector3(0.24, 0.78, 0.36),
      new Vector3(0.62, 0.92, 0.14),
    ]);
    const bronchioleCurve = new CatmullRomCurve3([
      new Vector3(-0.36, 1.48, -0.08),
      new Vector3(-0.3, 1.24, -0.04),
      new Vector3(-0.24, 1.02, -0.02),
    ]);

    const tintTube = (
      curve: CatmullRomCurve3,
      radius: number,
      segs: number
    ) => {
      const tube = new TubeGeometry(curve, segs, radius, 16, false);
      const pos = tube.getAttribute("position");
      const colors = new Float32Array(pos.count * 3);
      const venous = new Color(BIOME_COLORS.capillaryBlue);
      const arterial = new Color(
        highAltitude ? BIOME_COLORS.venousPlum : BIOME_COLORS.arterialCrimson
      );
      const c = new Color();
      for (let i = 0; i < pos.count; i += 1) {
        const y = pos.getY(i);
        const t = Math.min(1, Math.max(0, (y - 0.08) / 1.05));
        c.copy(venous).lerp(arterial, t);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      tube.setAttribute("color", new BufferAttribute(colors, 3));
      return tube;
    };

    return {
      branchTube: tintTube(branchCurve, 0.056, 40),
      bronchiole: new TubeGeometry(bronchioleCurve, 18, 0.13, 16, false),
      mainCurve,
      mainTube: tintTube(mainCurve, 0.125, 56),
    };
  }, [highAltitude]);

  useEffect(
    () => () => {
      network.mainTube.dispose();
      network.branchTube.dispose();
      network.bronchiole.dispose();
    },
    [network]
  );
  return network;
}

function AlveolusCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.1, 1.05, 3.25] : [0.08, 0.92, 2.65]}
      cameraTarget={[0, 0.65, 0]}
      fov={36}
      maxDistance={5.6}
      minDistance={1.3}
    />
  );
}

export function AlveolusGasExchangeScene({
  parts,
  state,
  ventilation,
}: {
  readonly parts: Readonly<
    Record<
      | "alveolus"
      | "capillary"
      | "carbonDioxide"
      | "oxygen"
      | "redBloodCell"
      | "surfactantFilm",
      string
    >
  >;
  readonly state: ActivityState;
  readonly ventilation: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const gasRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateAlveolusExchange(state, ventilation);

  const sacRadius = Math.min(0.6, Math.max(0.42, 0.4 + ventilation * 0.0068));
  const o2Visible = Math.min(
    O2_SLOTS.length,
    Math.max(2, Math.round(reading.pO2GradientMmHg / 16))
  );
  const { inner, outer } = useCutawayAlveolus();
  const bumpySac = useBumpySphere(1, 19, 0.055);
  const rbcGeom = useBiconcaveRbc();
  const { branchTube, bronchiole, mainCurve, mainTube } = useCapillaryNetwork(
    state === "highAltitude"
  );

  useFrame((_, delta) => {
    if (!playing || gasRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (1.2 + reading.diffusionIndex);
    gasRef.current.position.x = Math.sin(phaseRef.current) * 0.16;
  });

  const rbcPlacements = useMemo(
    () =>
      Arr.map(RBC_SLOTS, (t) => {
        const pt = mainCurve.getPointAt(t);
        const tangent = mainCurve.getTangentAt(t);
        const col = new Color(BIOME_COLORS.venousPlum).lerp(
          new Color(
            state === "highAltitude"
              ? BIOME_COLORS.capillaryBlue
              : BIOME_COLORS.arterialCrimson
          ),
          t
        );
        return {
          color: `#${col.getHexString()}`,
          id: `rbc-${t}`,
          pos: [pt.x, pt.y, pt.z] as const,
          rot: [tangent.y * 0.7, tangent.x * 0.8, Math.PI * 0.45] as const,
        };
      }),
    [mainCurve, state]
  );

  return (
    <group>
      <SimulationTicker running={playing} />
      <AlveolusCamera />

      {/* Terminal bronchiole stalk feeding the alveolar acinus */}
      <mesh castShadow geometry={bronchiole}>
        <meshPhysicalMaterial
          clearcoat={0.28}
          clearcoatRoughness={0.32}
          color={BIOME_COLORS.alveolusLumen}
          roughness={0.44}
        />
      </mesh>

      {/* Grape-cluster neighboring alveoli */}
      <group scale={sacRadius / 0.48}>
        {Arr.map(ACINUS_SACS, (sac) => (
          <mesh
            castShadow
            geometry={bumpySac}
            key={sac.id}
            position={sac.pos}
            receiveShadow
            scale={sac.r}
          >
            <meshPhysicalMaterial
              clearcoat={0.36}
              clearcoatRoughness={0.3}
              color={BIOME_COLORS.alveolusPink}
              roughness={0.42}
            />
          </mesh>
        ))}
      </group>

      {/* Hero cutaway alveolus wall + glistening wet surfactant film */}
      <group
        position={[-0.18, 0.62, 0.02]}
        rotation={[0, -0.65, 0]}
        scale={sacRadius}
      >
        <mesh castShadow geometry={outer} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.44}
            clearcoatRoughness={0.26}
            color={BIOME_COLORS.alveolusPink}
            opacity={0.86}
            roughness={0.36}
            side={DoubleSide}
            transparent
          />
        </mesh>
        <mesh geometry={inner}>
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.08}
            color={BIOME_COLORS.surfactantBlue}
            depthWrite={false}
            ior={1.34}
            opacity={0.42}
            roughness={0.12}
            side={DoubleSide}
            transparent
          />
        </mesh>
      </group>

      {/* Branching pulmonary capillary plexus with venous-to-arterial gradient */}
      <mesh geometry={mainTube}>
        <meshPhysicalMaterial
          clearcoat={0.78}
          clearcoatRoughness={0.14}
          depthWrite={false}
          opacity={0.44}
          roughness={0.22}
          transparent
          vertexColors
        />
      </mesh>
      <mesh geometry={branchTube}>
        <meshPhysicalMaterial
          clearcoat={0.68}
          clearcoatRoughness={0.18}
          depthWrite={false}
          opacity={0.52}
          roughness={0.28}
          transparent
          vertexColors
        />
      </mesh>

      {/* True Evans-Fung biconcave red blood cells flowing through capillary */}
      {Arr.map(rbcPlacements, (cell) => (
        <mesh
          castShadow
          geometry={rbcGeom}
          key={cell.id}
          position={cell.pos}
          rotation={cell.rot}
        >
          <meshPhysicalMaterial
            clearcoat={0.45}
            clearcoatRoughness={0.24}
            color={cell.color}
            roughness={0.32}
          />
        </mesh>
      ))}

      {/* Molecular diatomic O2 and triatomic CO2 diffusing across respiratory membrane */}
      <group ref={gasRef}>
        {Arr.map(Arr.take(O2_SLOTS, o2Visible), (slot) => {
          const y = 0.64 + (slot % 3) * 0.11;
          const x = 0.08 + slot * 0.075;
          const z = 0.14 + (slot - 2) * 0.04;
          return (
            <group
              key={`o2-${slot}`}
              position={[x, y, z]}
              rotation={[0.3, 0.4, slot]}
            >
              <mesh position={[-0.022, 0, 0]}>
                <sphereGeometry args={[0.028, 12, 12]} />
                <meshPhysicalMaterial
                  clearcoat={0.7}
                  color={BIOME_COLORS.oxygenCyan}
                  roughness={0.16}
                />
              </mesh>
              <mesh position={[0.022, 0, 0]}>
                <sphereGeometry args={[0.028, 12, 12]} />
                <meshPhysicalMaterial
                  clearcoat={0.7}
                  color={BIOME_COLORS.oxygenCyan}
                  roughness={0.16}
                />
              </mesh>
            </group>
          );
        })}
        {/* Triatomic CO2 diffusing into alveolar lumen */}
        <group position={[0.24, 0.42, 0.16]} rotation={[0.2, -0.3, 0.3]}>
          <mesh>
            <sphereGeometry args={[0.032, 12, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.4}
              color={BIOME_COLORS.carbonGray}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[-0.046, 0, 0]}>
            <sphereGeometry args={[0.024, 10, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={BIOME_COLORS.capillaryRed}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[0.046, 0, 0]}>
            <sphereGeometry args={[0.024, 10, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.5}
              color={BIOME_COLORS.capillaryRed}
              roughness={0.22}
            />
          </mesh>
        </group>
      </group>

      {/* Labels */}
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 1.24, 0]}
      >
        <span>{parts.alveolus}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.86, 0.48, 0.4]}
      >
        <span>{parts.surfactantFilm}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 1.06, 0.12]}
      >
        <span>{parts.capillary}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.94, 0.56, 0.24]}
      >
        <span>{parts.redBloodCell}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.18, 1.08, 0.26]}
      >
        <span>{parts.oxygen}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BIOME_COLORS.labelInk}
        fontSize="compact"
        position={[0.26, 0.14, 0.2]}
      >
        <span>{parts.carbonDioxide}</span>
      </ThreeLabel>
    </group>
  );
}
