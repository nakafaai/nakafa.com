import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { ThermalCondition } from "@repo/design-system/components/contents/biology/skin/model";
import { evaluateSkin } from "@repo/design-system/components/contents/biology/skin/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Wavy anatomical epidermis slab with dermal papillae ridges on the underside. */
function buildEpidermisGeometry() {
  const shape = new Shape();
  shape.moveTo(-0.84, 0.86);
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const x = -0.84 + t * 1.68;
    const y = 0.86 + Math.sin(t * Math.PI * 8) * 0.022;
    shape.lineTo(x, y);
  }
  shape.lineTo(0.84, 0.99);
  for (let i = 24; i >= 0; i -= 1) {
    const t = i / 24;
    const x = -0.84 + t * 1.68;
    const y = 0.99 + Math.sin(t * Math.PI * 6 + 0.6) * 0.008;
    shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    depth: 0.78,
  });
  geo.translate(0, 0, -0.39);
  return geo;
}

/** Tapered organic hair shaft emerging from a deep dermal hair bulb through the pore. */
function buildHairShaftGeometry() {
  const pts = [
    new Vector2(0.001, -0.34),
    new Vector2(0.056, -0.3),
    new Vector2(0.048, -0.22),
    new Vector2(0.026, -0.06),
    new Vector2(0.022, 0.14),
    new Vector2(0.016, 0.36),
    new Vector2(0.005, 0.5),
    new Vector2(0.001, 0.52),
  ];
  return new LatheGeometry(pts, 20);
}

/** Organic sinusoidal dermal arteriole + papillary capillary loop. */
function buildArterioleGeometry() {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.78, 0.4, 0.2),
    new Vector3(-0.38, 0.44, 0.22),
    new Vector3(0.04, 0.39, 0.24),
    new Vector3(0.44, 0.43, 0.2),
    new Vector3(0.78, 0.41, 0.18),
  ]);
  return new TubeGeometry(curve, 44, 0.046, 18, false);
}

function buildCapillaryLoopGeometry(xOffset: number) {
  const curve = new CatmullRomCurve3([
    new Vector3(xOffset - 0.14, 0.42, 0.22),
    new Vector3(xOffset - 0.1, 0.64, 0.24),
    new Vector3(xOffset, 0.82, 0.23),
    new Vector3(xOffset + 0.1, 0.64, 0.21),
    new Vector3(xOffset + 0.14, 0.42, 0.2),
  ]);
  return new TubeGeometry(curve, 36, 0.021, 14, false);
}

/** Realistic coiled eccrine sweat gland secretory tubule + rising excretory duct. */
function buildSweatGlandGeometry() {
  const coil = Arr.makeBy(43, (index) => {
    const t = index / 42;
    const angle = t * Math.PI * 6;
    const r = 0.068 * Math.sin(t * Math.PI);
    return new Vector3(
      Math.cos(angle) * r,
      -0.06 + t * 0.18 + Math.sin(angle * 2) * 0.015,
      Math.sin(angle) * r
    );
  });
  const duct = [
    new Vector3(0.015, 0.22, 0.01),
    new Vector3(-0.015, 0.38, -0.01),
    new Vector3(0, 0.56, 0),
  ];
  return new TubeGeometry(
    new CatmullRomCurve3(Arr.appendAll(coil, duct)),
    84,
    0.018,
    12,
    false
  );
}

/** Curved erector pili smooth muscle bundle connecting follicle to papillary dermis. */
function buildErectorMuscleGeometry() {
  const curve = new CatmullRomCurve3([
    new Vector3(-0.34, 0.56, 0.02),
    new Vector3(-0.22, 0.68, 0.06),
    new Vector3(-0.09, 0.84, 0.08),
  ]);
  return new TubeGeometry(curve, 24, 0.024, 12, false);
}

/** Organic adipocyte lobules packed across the subcutaneous hypodermis. */
const ADIPOCYTES = Arr.flatMap(Arr.range(0, 9), (col) =>
  Arr.map(Arr.range(0, 3), (row) => ({
    key: `fat-${col}-${row}`,
    radius: 0.072 + ((col * 7 + row * 3) % 4) * 0.008,
    x: -0.72 + col * 0.16 + (row % 2 === 0 ? 0.03 : -0.03),
    y: 0.11 + ((col + row) % 3) * 0.036,
    z: -0.26 + row * 0.175,
  }))
);

function SkinCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.48, 1.55, 3.85] : [0.38, 1.32, 3.05]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function SkinThermoregulationScene({
  ambientC,
  condition,
  parts,
}: {
  readonly ambientC: number;
  readonly condition: ThermalCondition;
  readonly parts: Readonly<
    Record<
      | "arteriole"
      | "capillary"
      | "epidermis"
      | "erectorMuscle"
      | "fatLayer"
      | "hairShaft"
      | "sweatGland",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const sweatRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateSkin(condition, ambientC);

  const epidermisGeo = useMemo(buildEpidermisGeometry, []);
  const hairGeo = useMemo(buildHairShaftGeometry, []);
  const arterioleGeo = useMemo(buildArterioleGeometry, []);
  const capLoopLeft = useMemo(() => buildCapillaryLoopGeometry(-0.08), []);
  const capLoopRight = useMemo(() => buildCapillaryLoopGeometry(0.28), []);
  const sweatGlandGeo = useMemo(buildSweatGlandGeometry, []);
  const erectorGeo = useMemo(buildErectorMuscleGeometry, []);

  useEffect(
    () => () => {
      epidermisGeo.dispose();
      hairGeo.dispose();
      arterioleGeo.dispose();
      capLoopLeft.dispose();
      capLoopRight.dispose();
      sweatGlandGeo.dispose();
      erectorGeo.dispose();
    },
    [
      arterioleGeo,
      capLoopLeft,
      capLoopRight,
      epidermisGeo,
      erectorGeo,
      hairGeo,
      sweatGlandGeo,
    ]
  );

  useFrame((_, delta) => {
    if (!playing || sweatRef.current === null) {
      return;
    }
    phaseRef.current +=
      simulationStep(delta) * (1.4 + reading.sweatIntensity * 1.8);
    sweatRef.current.position.y = 1.02 + ((phaseRef.current * 0.12) % 0.24);
  });

  const vesselScale = reading.arterioleScale;
  const sweatBeadRadius = 0.032 + reading.sweatIntensity * 0.026;

  return (
    <group>
      <SimulationTicker running={playing} />
      <SkinCamera />

      {/* Organic lobulated subcutaneous adipose tissue (hypodermis) */}
      <group>
        <mesh position={[0, 0.11, 0]} receiveShadow>
          <boxGeometry args={[1.66, 0.18, 0.76]} />
          <meshPhysicalMaterial
            color={HOMEOSTASIS_COLORS.fatLayer}
            opacity={0.45}
            roughness={0.55}
            transparent
          />
        </mesh>
        {Arr.map(ADIPOCYTES, (cell) => (
          <mesh
            castShadow
            key={cell.key}
            position={[cell.x, cell.y, cell.z]}
            scale={[1.15, 0.85, 1.05]}
          >
            <sphereGeometry args={[cell.radius, 14, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.55}
              clearcoatRoughness={0.28}
              color={HOMEOSTASIS_COLORS.fatLayer}
              roughness={0.42}
            />
          </mesh>
        ))}
      </group>

      {/* Translucent collagenous dermis chamber */}
      <mesh position={[0, 0.56, 0]}>
        <boxGeometry args={[1.66, 0.66, 0.76]} />
        <meshPhysicalMaterial
          clearcoat={0.25}
          color={HOMEOSTASIS_COLORS.epidermis}
          depthWrite={false}
          opacity={0.28}
          roughness={0.48}
          transparent
        />
      </mesh>

      {/* Sculpted wavy papillary epidermis */}
      <mesh castShadow geometry={epidermisGeo} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.32}
          clearcoatRoughness={0.45}
          color={HOMEOSTASIS_COLORS.epidermis}
          roughness={0.52}
        />
      </mesh>

      {/* Vasodilating / vasoconstricting dermal arteriole + papillary capillary loops */}
      <group position={[0, 0.41, 0.21]} scale={[1, vesselScale, vesselScale]}>
        <mesh castShadow geometry={arterioleGeo} position={[0, -0.41, -0.21]}>
          <meshPhysicalMaterial
            clearcoat={0.68}
            color={HOMEOSTASIS_COLORS.arteriole}
            roughness={0.28}
          />
        </mesh>
      </group>
      <group scale={[0.7 + vesselScale * 0.25, 1, 0.7 + vesselScale * 0.25]}>
        <mesh castShadow geometry={capLoopLeft}>
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={HOMEOSTASIS_COLORS.capillary}
            roughness={0.28}
          />
        </mesh>
        <mesh castShadow geometry={capLoopRight}>
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={HOMEOSTASIS_COLORS.capillary}
            roughness={0.28}
          />
        </mesh>
      </group>

      {/* Deep hair follicle bulb + tapered organic hair shaft pivoting at the epidermal pore */}
      <group
        position={[-0.32, 0.94, 0]}
        rotation={[0, 0, -reading.hairAngleRad]}
      >
        <mesh castShadow geometry={hairGeo}>
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={HOMEOSTASIS_COLORS.hairShaft}
            roughness={0.44}
          />
        </mesh>
      </group>

      {/* Curved erector pili muscle contracting when cold */}
      <mesh
        castShadow
        geometry={erectorGeo}
        scale={[1, 1, condition === "cold" ? 1.35 : 0.85]}
      >
        <meshPhysicalMaterial
          clearcoat={0.35}
          color={HOMEOSTASIS_COLORS.erectorMuscle}
          roughness={0.46}
        />
      </mesh>

      {/* Coiled eccrine sweat gland + secretory duct + glistening sweat droplets */}
      <group position={[0.52, 0.44, -0.04]}>
        <mesh castShadow geometry={sweatGlandGeo}>
          <meshPhysicalMaterial
            clearcoat={0.62}
            color={HOMEOSTASIS_COLORS.sweatGland}
            roughness={0.28}
          />
        </mesh>
      </group>
      {reading.sweatActive ? (
        <group position={[0.52, 1.03, -0.04]} ref={sweatRef}>
          <mesh castShadow>
            <sphereGeometry args={[sweatBeadRadius, 20, 18]} />
            <meshPhysicalMaterial
              clearcoat={1}
              clearcoatRoughness={0.04}
              color={HOMEOSTASIS_COLORS.sweatDrop}
              ior={1.33}
              opacity={0.78}
              roughness={0.05}
              transparent
            />
          </mesh>
          <mesh position={[-0.1, -0.01, 0.08]}>
            <sphereGeometry args={[sweatBeadRadius * 0.68, 16, 14]} />
            <meshPhysicalMaterial
              clearcoat={1}
              color={HOMEOSTASIS_COLORS.sweatDrop}
              ior={1.33}
              opacity={0.72}
              roughness={0.06}
              transparent
            />
          </mesh>
        </group>
      ) : null}

      {/* Clean, legible, well-framed labels (zero left/right clipping) */}
      <ThreeLabel color={ink} fontSize="compact" position={[-0.36, 1.38, 0]}>
        <span>{parts.hairShaft}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.78, 1.06, 0.25]}>
        <span>{parts.epidermis}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.64, 1.24, 0]}>
        <span>{parts.sweatGland}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.74, 0.78, 0.34]}>
        <span>{parts.capillary}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.58, 0.48, 0.44]}>
        <span>{parts.arteriole}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.05, 0.74, -0.28]}>
        <span>{parts.erectorMuscle}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0, -0.04, 0.46]}>
        <span>{parts.fatLayer}</span>
      </ThreeLabel>
    </group>
  );
}
