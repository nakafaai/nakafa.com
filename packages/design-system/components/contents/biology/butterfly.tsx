import { useFrame } from "@react-three/fiber";
import { buildStemGeometry } from "@repo/design-system/components/contents/biology/botanical";
import { INSECT_LEG_PAIRS } from "@repo/design-system/components/contents/biology/entomology";
import {
  createBotanicalCanvas,
  finalizeBotanicalTexture,
} from "@repo/design-system/components/contents/biology/foliage";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  DoubleSide,
  LatheGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from "three";

const WING_SIZE = 512;

function paintMonarchWingBase(
  col: CanvasRenderingContext2D,
  bump: CanvasRenderingContext2D,
  s: number
) {
  const grad = col.createRadialGradient(
    s * 0.16,
    s * 0.52,
    12,
    s * 0.45,
    s * 0.5,
    s * 0.7
  );
  grad.addColorStop(0, SPECIMEN_COLORS.butterflyWingDeep);
  grad.addColorStop(0.32, SPECIMEN_COLORS.butterflyWingMid);
  grad.addColorStop(0.74, SPECIMEN_COLORS.butterflyWingLight);
  grad.addColorStop(1, SPECIMEN_COLORS.butterflyWingEdge);
  col.fillStyle = grad;
  col.fillRect(0, 0, s, s);

  bump.fillStyle = SPECIMEN_COLORS.bumpWarm;
  bump.fillRect(0, 0, s, s);
  for (let i = 0; i < 650; i += 1) {
    const sx = valueNoise(i * 2.1, 4.3, 64) * s;
    const sy = valueNoise(3.7, i * 1.9, 64) * s;
    bump.fillStyle =
      i % 2 === 0 ? SPECIMEN_COLORS.bumpMidHigh : SPECIMEN_COLORS.bumpMidLow;
    bump.fillRect(sx, sy, 6, 3);
  }
}

function paintMonarchWingVeinsAndSpots(
  col: CanvasRenderingContext2D,
  bump: CanvasRenderingContext2D,
  s: number
) {
  col.strokeStyle = SPECIMEN_COLORS.butterflyBorder;
  col.lineWidth = 56;
  col.beginPath();
  col.moveTo(0, s * 0.06);
  col.quadraticCurveTo(s * 0.65, 0, s * 0.94, s * 0.35);
  col.quadraticCurveTo(s * 0.96, s * 0.72, s * 0.72, s * 0.96);
  col.lineTo(0, s * 0.96);
  col.stroke();

  col.fillStyle = SPECIMEN_COLORS.butterflyBorder;
  col.beginPath();
  col.moveTo(s * 0.52, 0);
  col.lineTo(s, 0);
  col.lineTo(s, s * 0.48);
  col.quadraticCurveTo(s * 0.7, s * 0.34, s * 0.52, 0);
  col.fill();

  col.strokeStyle = SPECIMEN_COLORS.butterflyThorax;
  bump.strokeStyle = SPECIMEN_COLORS.bumpRidge;
  col.lineCap = "round";
  const discX = s * 0.42;
  const discY = s * 0.48;
  for (let v = 0; v < 9; v += 1) {
    const targetY = s * (0.08 + v * 0.105);
    const targetX = v < 2 ? s * (0.68 + v * 0.14) : s * 0.96;
    col.lineWidth = v === 0 || v === 4 ? 11 : 7.5;
    col.beginPath();
    col.moveTo(14, s * 0.54);
    col.quadraticCurveTo(discX, discY + (v - 4) * 26, targetX, targetY);
    col.stroke();

    bump.lineWidth = 8;
    bump.beginPath();
    bump.moveTo(14, s * 0.54);
    bump.quadraticCurveTo(discX, discY + (v - 4) * 26, targetX, targetY);
    bump.stroke();
  }
  col.lineWidth = 10;
  col.beginPath();
  col.moveTo(s * 0.44, s * 0.34);
  col.quadraticCurveTo(s * 0.54, s * 0.48, s * 0.42, s * 0.64);
  col.stroke();

  col.fillStyle = SPECIMEN_COLORS.butterflySpot;
  for (let i = 0; i < 11; i += 1) {
    const t = i / 10;
    const arcX = s * (0.88 - t * 0.16);
    const arcY = s * (0.14 + t * 0.78);
    col.beginPath();
    col.ellipse(arcX, arcY, 8.5, 5.5, -0.25, 0, Math.PI * 2);
    col.fill();
    col.beginPath();
    col.ellipse(arcX - 20, arcY + 14, 6.2, 4.2, -0.25, 0, Math.PI * 2);
    col.fill();
  }
  const apicalSpots = [
    [s * 0.66, s * 0.14, 13, 8.5],
    [s * 0.76, s * 0.2, 12, 8],
    [s * 0.68, s * 0.28, 10.5, 7],
    [s * 0.82, s * 0.3, 9.5, 6.5],
  ] as const;
  for (const [ax, ay, rx, ry] of apicalSpots) {
    col.beginPath();
    col.ellipse(ax, ay, rx, ry, -0.35, 0, Math.PI * 2);
    col.fill();
  }
}

function useMonarchWingTextures() {
  const maps = useMemo(() => {
    const col = createBotanicalCanvas(WING_SIZE);
    const bump = createBotanicalCanvas(WING_SIZE);

    if (col.ctx !== null && bump.ctx !== null) {
      paintMonarchWingBase(col.ctx, bump.ctx, WING_SIZE);
      paintMonarchWingVeinsAndSpots(col.ctx, bump.ctx, WING_SIZE);
    }

    return {
      bumpMap: finalizeBotanicalTexture(bump.canvas, false),
      map: finalizeBotanicalTexture(col.canvas, true),
    };
  }, []);

  useEffect(
    () => () => {
      maps.map.dispose();
      maps.bumpMap.dispose();
    },
    [maps]
  );

  return maps;
}

/**
 * Museum-grade sculpted adult Monarch Butterfly with overlapping curved
 * forewings and hindwings (512px veined pattern + white marginal spots),
 * velvety white-spotted thorax & segmented abdomen, compound eyes, clubbed
 * antennae, coiled spiral proboscis, and 6 jointed legs.
 */
export function MonarchButterfly({
  playing = false,
}: {
  readonly playing?: boolean;
}) {
  const leftRef = useRef<Group>(null);
  const rightRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const wingTex = useMonarchWingTextures();

  const geos = useMemo(() => {
    const abdPts = Arr.map(Arr.range(0, 22), (s) => {
      const t = s / 22;
      const r =
        Math.max(0.003, 0.032 * Math.sin(t * Math.PI) ** 0.5) *
        (1 - 0.06 * Math.abs(Math.sin(t * Math.PI * 8)));
      return new Vector2(r, (t - 0.5) * 0.24);
    });
    const abdomen = new LatheGeometry(abdPts, 20);
    abdomen.rotateZ(Math.PI / 2);

    const foreShape = new Shape();
    foreShape.moveTo(0, 0);
    foreShape.bezierCurveTo(0.08, 0.19, 0.24, 0.29, 0.38, 0.24);
    foreShape.bezierCurveTo(0.42, 0.16, 0.36, 0.05, 0.26, -0.02);
    foreShape.bezierCurveTo(0.16, -0.05, 0.06, -0.04, 0, -0.02);
    foreShape.closePath();
    const forewing = new ShapeGeometry(foreShape, 24);
    const fPos = forewing.getAttribute("position");
    const fUv = forewing.getAttribute("uv");
    for (let i = 0; i < fPos.count; i += 1) {
      const fx = fPos.getX(i);
      const fy = fPos.getY(i);
      fPos.setZ(i, Math.sin((fx / 0.42) * Math.PI) * 0.024);
      fUv.setXY(
        i,
        Math.min(1, Math.max(0, fx / 0.42)),
        Math.min(1, Math.max(0, 1 - (fy + 0.06) / 0.35))
      );
    }
    forewing.computeVertexNormals();

    const hindShape = new Shape();
    hindShape.moveTo(0, -0.01);
    hindShape.bezierCurveTo(0.12, -0.02, 0.25, -0.06, 0.26, -0.15);
    hindShape.bezierCurveTo(0.24, -0.24, 0.12, -0.28, 0.03, -0.22);
    hindShape.bezierCurveTo(-0.02, -0.16, -0.01, -0.08, 0, -0.01);
    hindShape.closePath();
    const hindwing = new ShapeGeometry(hindShape, 22);
    const hPos = hindwing.getAttribute("position");
    const hUv = hindwing.getAttribute("uv");
    for (let i = 0; i < hPos.count; i += 1) {
      const hx = hPos.getX(i);
      const hy = hPos.getY(i);
      hPos.setZ(i, -0.006 + Math.sin((hx / 0.28) * Math.PI) * 0.014);
      hUv.setXY(
        i,
        Math.min(1, Math.max(0, hx / 0.28)),
        Math.min(1, Math.max(0, 1 - (hy + 0.28) / 0.28))
      );
    }
    hindwing.computeVertexNormals();

    const antenna = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.06, 0.045, 0.024),
        new Vector3(0.14, 0.075, 0.056),
        new Vector3(0.175, 0.078, 0.072),
      ],
      0.0038,
      0.0055,
      14,
      8
    );
    const probPts = Arr.makeBy(24, (k) => {
      const t = k / 23;
      const ang = t * Math.PI * 3.4;
      const r = 0.024 * (1 - t * 0.72);
      return new Vector3(
        0.025 + Math.cos(ang) * r,
        -0.022 - Math.sin(ang) * r,
        0
      );
    });
    const proboscis = buildStemGeometry(probPts, 0.0032, 0.0014, 24, 6);
    const leg = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.012, -0.036, 0.035),
        new Vector3(0.004, -0.078, 0.058),
        new Vector3(0.024, -0.095, 0.075),
      ],
      0.004,
      0.0018,
      10,
      6
    );

    return { abdomen, antenna, forewing, hindwing, leg, proboscis };
  }, []);

  useEffect(
    () => () => {
      geos.abdomen.dispose();
      geos.forewing.dispose();
      geos.hindwing.dispose();
      geos.antenna.dispose();
      geos.proboscis.dispose();
      geos.leg.dispose();
    },
    [geos]
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 3.6;
    const flap = Math.sin(phaseRef.current) * 0.24;
    if (leftRef.current !== null) {
      leftRef.current.rotation.x = -0.42 - flap;
    }
    if (rightRef.current !== null) {
      rightRef.current.rotation.x = 0.42 + flap;
    }
  });

  return (
    <group position={[0, 0.095, 0]} rotation={[0.08, -0.22, 0]}>
      <mesh castShadow geometry={geos.abdomen} position={[-0.085, 0, 0]}>
        <meshPhysicalMaterial
          clearcoat={0.22}
          color={SPECIMEN_COLORS.butterflyAbd}
          roughness={0.58}
        />
      </mesh>
      <mesh castShadow position={[0.06, 0.012, 0]} scale={[1.35, 0.96, 0.92]}>
        <meshPhysicalMaterial
          clearcoat={0.22}
          color={SPECIMEN_COLORS.butterflyThorax}
          roughness={0.62}
        />
        <sphereGeometry args={[0.044, 18, 14]} />
      </mesh>
      {Arr.map([-0.018, 0.018] as const, (zOff) => (
        <mesh key={`dot-${zOff}`} position={[0.068, 0.042, zOff]}>
          <sphereGeometry args={[0.006, 8, 6]} />
          <meshStandardMaterial
            color={SPECIMEN_COLORS.butterflyDot}
            roughness={0.5}
          />
        </mesh>
      ))}
      <group position={[0.132, 0.018, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.032, 16, 12]} />
          <meshStandardMaterial
            color={SPECIMEN_COLORS.butterflyHead}
            roughness={0.48}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            key={`be-${side}`}
            position={[0.008, 0.004, side * 0.022]}
            scale={[0.9, 1.08, 0.72]}
          >
            <sphereGeometry args={[0.019, 14, 10]} />
            <meshPhysicalMaterial
              clearcoat={0.85}
              color={SPECIMEN_COLORS.butterflyEye}
              roughness={0.18}
            />
          </mesh>
        ))}
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            geometry={geos.antenna}
            key={`ba-${side}`}
            position={[0.016, 0.018, side * 0.012]}
            scale={[1, 1, side]}
          >
            <meshStandardMaterial
              color={SPECIMEN_COLORS.butterflyAnt}
              roughness={0.45}
            />
          </mesh>
        ))}
        <mesh geometry={geos.proboscis}>
          <meshStandardMaterial
            color={SPECIMEN_COLORS.butterflyProboscis}
            roughness={0.42}
          />
        </mesh>
      </group>
      {Arr.map(INSECT_LEG_PAIRS, (leg) => (
        <mesh
          geometry={geos.leg}
          key={`bl-${leg.id}`}
          position={[0.045 + leg.x * 1.4, -0.018, leg.zSign * 0.022]}
          rotation={[0, leg.rx * leg.zSign, 0]}
          scale={[1, 1, leg.zSign]}
        >
          <meshStandardMaterial
            color={SPECIMEN_COLORS.butterflyLeg}
            roughness={0.5}
          />
        </mesh>
      ))}
      <group
        position={[0.055, 0.036, 0.022]}
        ref={leftRef}
        rotation={[-0.42, 0, 0]}
      >
        <group rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <mesh castShadow geometry={geos.forewing}>
            <meshPhysicalMaterial
              bumpMap={wingTex.bumpMap}
              bumpScale={0.01}
              clearcoat={0.18}
              emissive={SPECIMEN_COLORS.butterflyWingEmissive}
              emissiveIntensity={0.22}
              map={wingTex.map}
              roughness={0.5}
              side={DoubleSide}
            />
          </mesh>
          <mesh castShadow geometry={geos.hindwing}>
            <meshPhysicalMaterial
              bumpMap={wingTex.bumpMap}
              bumpScale={0.01}
              clearcoat={0.18}
              emissive={SPECIMEN_COLORS.butterflyWingEmissive}
              emissiveIntensity={0.22}
              map={wingTex.map}
              roughness={0.52}
              side={DoubleSide}
            />
          </mesh>
        </group>
      </group>
      <group
        position={[0.055, 0.036, -0.022]}
        ref={rightRef}
        rotation={[0.42, 0, 0]}
        scale={[1, 1, -1]}
      >
        <group rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <mesh castShadow geometry={geos.forewing}>
            <meshPhysicalMaterial
              bumpMap={wingTex.bumpMap}
              bumpScale={0.01}
              clearcoat={0.18}
              emissive={SPECIMEN_COLORS.butterflyWingEmissive}
              emissiveIntensity={0.22}
              map={wingTex.map}
              roughness={0.5}
              side={DoubleSide}
            />
          </mesh>
          <mesh castShadow geometry={geos.hindwing}>
            <meshPhysicalMaterial
              bumpMap={wingTex.bumpMap}
              bumpScale={0.01}
              clearcoat={0.18}
              emissive={SPECIMEN_COLORS.butterflyWingEmissive}
              emissiveIntensity={0.22}
              map={wingTex.map}
              roughness={0.52}
              side={DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
