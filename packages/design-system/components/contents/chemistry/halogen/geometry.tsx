import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, LatheGeometry, Path, Shape, Vector2 } from "three";

const RACK_SLOTS = [-0.072, 0, 0.072] as const;

function createBoredRailGeometry() {
  const halfW = 0.114;
  const halfD = 0.034;
  const r = 0.006;
  const shape = new Shape();
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
  shape.lineTo(halfW, halfD - r);
  shape.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
  shape.lineTo(-halfW + r, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
  shape.lineTo(-halfW, -halfD + r);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);

  const holes = Arr.map(RACK_SLOTS, (slotX) => {
    const hole = new Path();
    hole.absarc(slotX, 0, 0.0235, 0, Math.PI * 2, true);
    return hole;
  });
  shape.holes = holes;

  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.0014,
    bevelThickness: 0.0014,
    depth: 0.012,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Turned round-bottom borosilicate test tube with flared lip (y = 0.012..0.205). */
export function createTestTubeGeometry() {
  const outerR = 0.021;
  const innerR = 0.0192;
  const centerY = 0.033;
  const outerArc = Arr.makeBy(10, (index) => {
    const theta = (index / 9) * (Math.PI / 2);
    return new Vector2(
      Math.max(0.0005, Math.sin(theta) * outerR),
      centerY - Math.cos(theta) * outerR
    );
  });
  const innerArc = Arr.makeBy(10, (index) => {
    const theta = ((9 - index) / 9) * (Math.PI / 2);
    return new Vector2(
      Math.max(0.0005, Math.sin(theta) * innerR),
      centerY - Math.cos(theta) * innerR
    );
  });
  const lip = [
    new Vector2(outerR, 0.199),
    new Vector2(0.0246, 0.204),
    new Vector2(0.0234, 0.2058),
    new Vector2(innerR, 0.2),
  ];
  return new LatheGeometry([...outerArc, ...lip, ...innerArc], 56);
}

/** Turned borosilicate dropping pipette body (local y = 0 at nozzle tip, up to 0.088). */
function createPipetteGeometry() {
  const profile = Arr.map(
    [
      [0.0016, 0],
      [0.0022, 0.012],
      [0.0046, 0.028],
      [0.0068, 0.038],
      [0.0068, 0.084],
      [0.0086, 0.087],
      [0.0074, 0.089],
      [0.0054, 0.084],
      [0.0054, 0.037],
      [0.0032, 0.027],
      [0.001, 0.002],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 36);
}

/** Turned dark nitrile rubber pipette squeeze bulb (local y = 0..0.044). */
function createBulbGeometry() {
  const profile = Arr.map(
    [
      [0.0078, 0],
      [0.0092, 0.004],
      [0.0085, 0.009],
      [0.0125, 0.02],
      [0.013, 0.031],
      [0.0096, 0.04],
      [0.0045, 0.044],
      [0.0004, 0.045],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 32);
}

/** Turned teardrop droplet geometry (centered around origin, height ~0.014 m). */
export function createTeardropGeometry() {
  const profile = Arr.map(
    [
      [0.0002, -0.006],
      [0.0032, -0.0052],
      [0.005, -0.0028],
      [0.0048, 0.0004],
      [0.003, 0.0038],
      [0.0011, 0.0068],
      [0.0002, 0.0084],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 24);
}

/** Oak wooden laboratory test-tube rack with bored upper retainer rail and brass dowels. */
export function TestTubeRack() {
  const railGeo = useMemo(createBoredRailGeometry, []);
  useEffect(() => () => railGeo.dispose(), [railGeo]);

  return (
    <group>
      {/* Solid oak base plate resting directly on bench y = 0 */}
      <mesh castShadow position={[0, 0.008, 0]} receiveShadow>
        <boxGeometry args={[0.24, 0.016, 0.076]} />
        <meshStandardMaterial color={INSTRUMENT_COLORS.oak} roughness={0.68} />
      </mesh>
      {/* Recessed rubber feet at corners */}
      {Arr.map(
        [
          [-0.106, -0.028],
          [0.106, -0.028],
          [-0.106, 0.028],
          [0.106, 0.028],
        ] as const,
        ([x, z]) => (
          <mesh key={`foot-${x}-${z}`} position={[x, 0.001, z]}>
            <cylinderGeometry args={[0.007, 0.007, 0.002, 16]} />
            <meshStandardMaterial
              color={CAR_COLORS.dashboard}
              roughness={0.9}
            />
          </mesh>
        )
      )}
      {/* Carved circular bottom resting wells */}
      {Arr.map(RACK_SLOTS, (slotX) => (
        <mesh
          key={`well-${slotX}`}
          position={[slotX, 0.0162, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.017, 0.0018, 8, 28]} />
          <meshStandardMaterial
            color={INSTRUMENT_COLORS.hair}
            roughness={0.78}
          />
        </mesh>
      ))}
      {/* Twin oak end stanchions and brass assembly dowels */}
      {Arr.map([-0.106, 0.106] as const, (x) => (
        <group key={`stanchion-${x}`} position={[x, 0, 0]}>
          <mesh castShadow position={[0, 0.072, 0]} receiveShadow>
            <boxGeometry args={[0.016, 0.112, 0.068]} />
            <meshStandardMaterial
              color={INSTRUMENT_COLORS.oak}
              roughness={0.68}
            />
          </mesh>
          {Arr.map([-0.018, 0.018] as const, (z) => (
            <mesh key={`dowel-${x}-${z}`} position={[0, 0.129, z]}>
              <cylinderGeometry args={[0.0032, 0.0032, 0.006, 14]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Mid-height rear oak brace */}
      <mesh castShadow position={[0, 0.064, -0.028]} receiveShadow>
        <boxGeometry args={[0.204, 0.022, 0.009]} />
        <meshStandardMaterial color={INSTRUMENT_COLORS.oak} roughness={0.7} />
      </mesh>
      {/* Upper bored retainer rail with 3 genuine circular holes */}
      <mesh
        castShadow
        geometry={railGeo}
        position={[0, 0.116, 0]}
        receiveShadow
      >
        <meshStandardMaterial color={INSTRUMENT_COLORS.oak} roughness={0.66} />
      </mesh>
    </group>
  );
}

/** Chrome retort stand + clamp holding a borosilicate dropping pipette above the test tube. */
export function ClampedPipette({ dropColor }: { readonly dropColor: string }) {
  const { bulbGeo, pipetteGeo } = useMemo(
    () => ({
      bulbGeo: createBulbGeometry(),
      pipetteGeo: createPipetteGeometry(),
    }),
    []
  );

  useEffect(
    () => () => {
      bulbGeo.dispose();
      pipetteGeo.dispose();
    },
    [bulbGeo, pipetteGeo]
  );

  return (
    <group>
      {/* Cast-iron retort base sitting directly on LabBench behind/left of rack */}
      <mesh castShadow position={[-0.145, 0.005, -0.056]} receiveShadow>
        <boxGeometry args={[0.095, 0.01, 0.072]} />
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.58} />
      </mesh>
      {/* Vertical brushed chrome retort rod */}
      <mesh castShadow position={[-0.155, 0.172, -0.056]}>
        <cylinderGeometry args={[0.0045, 0.0045, 0.334, 18]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
      </mesh>
      {/* Bosshead block and brass thumbscrew */}
      <group position={[-0.155, 0.278, -0.056]}>
        <mesh castShadow>
          <boxGeometry args={[0.022, 0.024, 0.022]} />
          <MetalMaterial color={CAR_COLORS.hub} roughness={0.42} />
        </mesh>
        <mesh position={[-0.017, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0042, 0.0042, 0.012, 14]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.32} />
        </mesh>
      </group>
      {/* Horizontal angled clamp arm reaching to pipette directly above test tube */}
      <mesh
        castShadow
        position={[-0.08, 0.278, -0.028]}
        rotation={[0, -0.35, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0034, 0.0034, 0.165, 14]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.26} />
      </mesh>
      {/* Rubber-sleeved clamp collar gripping the pipette barrel */}
      <mesh position={[0, 0.278, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0085, 0.0028, 10, 24]} />
        <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.82} />
      </mesh>

      {/* Turned borosilicate dropping pipette positioned at x = 0, nozzle at y = 0.222 */}
      <group position={[0, 0.222, 0]}>
        {/* Tinted halogen water column inside pipette barrel */}
        <ColumnLiquid
          bottom={0.036}
          color={dropColor}
          level={0.072}
          opacity={0.82}
          radius={0.0049}
        />
        {/* Tapered nozzle liquid tip */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.0044, 0.0014, 0.03, 18]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={dropColor}
            opacity={0.78}
            roughness={0.14}
            transparent
          />
        </mesh>
        {/* Borosilicate glass dropper barrel */}
        <mesh castShadow geometry={pipetteGeo} renderOrder={2}>
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.32} />
        </mesh>
        {/* Dark nitrile rubber squeeze bulb */}
        <mesh castShadow geometry={bulbGeo} position={[0, 0.084, 0]}>
          <meshStandardMaterial color={CAR_COLORS.dashboard} roughness={0.72} />
        </mesh>
      </group>
    </group>
  );
}
