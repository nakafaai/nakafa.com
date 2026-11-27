import { useFrame } from "@react-three/fiber";
import { buildStemGeometry } from "@repo/design-system/components/contents/biology/botanical";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  CanvasTexture,
  DoubleSide,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";

const SKIN = 512;
const TEETH = 7;
const FORE = { height: 0.2, left: 0, low: -0.045, width: 0.34 } as const;
const HIND = { height: 0.19, left: 0, low: -0.2, width: 0.17 } as const;
const LEGS = [-0.03, 0.005, 0.04] as const;

/** Black velvet scales with fine dark veins fanning from the wing base, the ground both wings share. */
function paintVelvet(ctx: CanvasRenderingContext2D, veins: number) {
  ctx.fillStyle = CLASSIFICATION_COLORS.birdwingBlack;
  ctx.fillRect(0, 0, SKIN, SKIN);
  ctx.strokeStyle = CLASSIFICATION_COLORS.birdwingVein;
  ctx.lineWidth = 3;
  for (let vein = 0; vein < veins; vein += 1) {
    const angle = -0.1 - (vein / (veins - 1)) * 1.25;
    ctx.beginPath();
    ctx.moveTo(8, SKIN * 0.72);
    ctx.quadraticCurveTo(
      SKIN * 0.4,
      SKIN * 0.72 + Math.sin(angle) * SKIN * 0.3,
      8 + Math.cos(angle) * SKIN * 1.1,
      SKIN * 0.72 + Math.sin(angle) * SKIN * 1.1
    );
    ctx.stroke();
  }
}

/** The forewing of Rajah Brooke's birdwing: seven metallic green teeth pointing at the outer margin. */
function createForewingSkin() {
  const canvas = document.createElement("canvas");
  canvas.width = SKIN;
  canvas.height = SKIN;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    paintVelvet(ctx, 9);
    for (let tooth = 0; tooth < TEETH; tooth += 1) {
      const along = tooth / (TEETH - 1);
      const x = SKIN * (0.3 + along * 0.36);
      const y = SKIN * (0.84 - along * 0.52);
      const reach = SKIN * (0.27 - along * 0.1);
      const half = SKIN * (0.05 - along * 0.012);
      const glow = ctx.createLinearGradient(x, y, x + reach, y + reach * 0.42);
      glow.addColorStop(0, CLASSIFICATION_COLORS.birdwingGlow);
      glow.addColorStop(0.5, CLASSIFICATION_COLORS.birdwingGreen);
      glow.addColorStop(1, CLASSIFICATION_COLORS.birdwingGreen);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(x - half * 0.4, y - half);
      ctx.quadraticCurveTo(
        x + reach * 0.5,
        y - half * 0.2,
        x + reach,
        y + reach * 0.42
      );
      ctx.quadraticCurveTo(x + reach * 0.4, y + half, x + half * 0.4, y + half);
      ctx.closePath();
      ctx.fill();
    }
  }
  const skin = new CanvasTexture(canvas);
  skin.colorSpace = SRGBColorSpace;
  return skin;
}

/** The hindwing: one broad green field over the cell, darkening to the black scalloped margin. */
function createHindwingSkin() {
  const canvas = document.createElement("canvas");
  canvas.width = SKIN;
  canvas.height = SKIN;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    paintVelvet(ctx, 7);
    const field = ctx.createRadialGradient(
      SKIN * 0.3,
      SKIN * 0.35,
      SKIN * 0.04,
      SKIN * 0.34,
      SKIN * 0.42,
      SKIN * 0.4
    );
    field.addColorStop(0, CLASSIFICATION_COLORS.birdwingGlow);
    field.addColorStop(0.55, CLASSIFICATION_COLORS.birdwingGreen);
    field.addColorStop(1, CLASSIFICATION_COLORS.birdwingBlack);
    ctx.fillStyle = field;
    ctx.beginPath();
    ctx.ellipse(SKIN * 0.34, SKIN * 0.42, SKIN * 0.3, SKIN * 0.34, 0.3, 0, 7);
    ctx.fill();
  }
  const skin = new CanvasTexture(canvas);
  skin.colorSpace = SRGBColorSpace;
  return skin;
}

/** Stretches a flat wing's texture coordinates over the box its outline fills. */
function fitSkin(
  wing: ShapeGeometry,
  box: { height: number; left: number; low: number; width: number }
) {
  const corner = wing.getAttribute("uv");
  for (let index = 0; index < corner.count; index += 1) {
    corner.setXY(
      index,
      (corner.getX(index) - box.left) / box.width,
      (corner.getY(index) - box.low) / box.height
    );
  }
  return wing;
}

function useBirdwingParts() {
  const parts = useMemo(() => {
    const fore = new Shape();
    fore.moveTo(0.008, 0.035);
    fore.bezierCurveTo(0.1, 0.11, 0.24, 0.155, 0.335, 0.145);
    fore.bezierCurveTo(0.32, 0.09, 0.24, 0.01, 0.16, -0.03);
    fore.bezierCurveTo(0.1, -0.045, 0.04, -0.03, 0.008, -0.01);
    fore.closePath();

    const hind = new Shape();
    hind.moveTo(0.008, -0.012);
    hind.bezierCurveTo(0.07, -0.02, 0.14, -0.035, 0.165, -0.07);
    hind.bezierCurveTo(0.17, -0.12, 0.13, -0.17, 0.085, -0.195);
    hind.bezierCurveTo(0.05, -0.185, 0.02, -0.14, 0.008, -0.09);
    hind.closePath();

    const feeler = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.03, 0.05, 0.006),
        new Vector3(0.05, 0.11, 0.004),
      ],
      0.0022,
      0.004,
      10,
      6
    );
    const leg = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.022, 0, -0.02),
        new Vector3(0.036, 0, -0.06),
      ],
      0.0028,
      0.0012,
      8,
      5
    );
    return {
      feeler,
      fore: fitSkin(new ShapeGeometry(fore, 20), FORE),
      foreSkin: createForewingSkin(),
      hind: fitSkin(new ShapeGeometry(hind, 20), HIND),
      hindSkin: createHindwingSkin(),
      leg,
    };
  }, []);

  useEffect(
    () => () => {
      parts.feeler.dispose();
      parts.fore.dispose();
      parts.foreSkin.dispose();
      parts.hind.dispose();
      parts.hindSkin.dispose();
      parts.leg.dispose();
    },
    [parts]
  );
  return parts;
}

/**
 * Rajah Brooke's birdwing, Trogonoptera brookiana, set on a brass specimen pin:
 * long velvet black forewings with seven metallic green teeth, green hindwings,
 * the red collar behind the head, clubbed antennae and six legs. While the card
 * plays the wings open and close slowly, as a resting butterfly's do.
 */
export function BirdwingSpecimen() {
  const parts = useBirdwingParts();
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += simulationStep(delta);
    const lift = 0.3 + Math.sin(time.current * 1.6) * 0.24;
    if (left.current && right.current) {
      right.current.rotation.y = -lift;
      left.current.rotation.y = lift;
    }
  });

  return (
    <group>
      <mesh castShadow position={[0, 0.012, 0]} receiveShadow>
        <cylinderGeometry args={[0.07, 0.078, 0.024, 28]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={CLASSIFICATION_COLORS.gardenTimber}
          roughness={0.5}
        />
      </mesh>
      <mesh castShadow position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.0022, 0.0022, 0.3, 8]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.birdwingGold}
          metalness={0.9}
          roughness={0.25}
        />
      </mesh>

      <group position={[0, 0.3, 0]} rotation={[-1.08, 0, 0]}>
        <mesh castShadow position={[0, 0.02, 0]} scale={[1, 1, 0.9]}>
          <capsuleGeometry args={[0.017, 0.04, 8, 14]} />
          <meshPhysicalMaterial
            color={CLASSIFICATION_COLORS.birdwingBlack}
            roughness={0.7}
          />
        </mesh>
        <mesh castShadow position={[0, -0.075, 0]}>
          <capsuleGeometry args={[0.011, 0.11, 8, 12]} />
          <meshPhysicalMaterial
            color={CLASSIFICATION_COLORS.birdwingBlack}
            roughness={0.6}
          />
        </mesh>
        <mesh position={[0, 0.058, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.011, 0.006, 8, 16]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.birdwingRed}
            roughness={0.6}
          />
        </mesh>
        <mesh castShadow position={[0, 0.075, 0]}>
          <sphereGeometry args={[0.013, 14, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.6}
            color={CLASSIFICATION_COLORS.birdwingBlack}
            roughness={0.4}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <group key={`side-${side}`} scale={[side, 1, 1]}>
            <mesh geometry={parts.feeler} position={[0.005, 0.082, 0]}>
              <meshStandardMaterial
                color={CLASSIFICATION_COLORS.birdwingVein}
                roughness={0.5}
              />
            </mesh>
            {Arr.map(LEGS, (y) => (
              <mesh
                geometry={parts.leg}
                key={`leg-${y}`}
                position={[0.01, y, 0]}
              >
                <meshStandardMaterial
                  color={CLASSIFICATION_COLORS.birdwingVein}
                  roughness={0.5}
                />
              </mesh>
            ))}
          </group>
        ))}
        <group ref={right}>
          <mesh castShadow geometry={parts.fore}>
            <meshPhysicalMaterial
              clearcoat={0.35}
              clearcoatRoughness={0.4}
              map={parts.foreSkin}
              roughness={0.42}
              side={DoubleSide}
            />
          </mesh>
          <mesh castShadow geometry={parts.hind} position={[0, 0, -0.002]}>
            <meshPhysicalMaterial
              clearcoat={0.35}
              map={parts.hindSkin}
              roughness={0.42}
              side={DoubleSide}
            />
          </mesh>
        </group>
        <group ref={left} scale={[-1, 1, 1]}>
          <mesh castShadow geometry={parts.fore}>
            <meshPhysicalMaterial
              clearcoat={0.35}
              clearcoatRoughness={0.4}
              map={parts.foreSkin}
              roughness={0.42}
              side={DoubleSide}
            />
          </mesh>
          <mesh castShadow geometry={parts.hind} position={[0, 0, -0.002]}>
            <meshPhysicalMaterial
              clearcoat={0.35}
              map={parts.hindSkin}
              roughness={0.42}
              side={DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
