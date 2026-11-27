import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  LatheGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
} from "three";

/**
 * Procedural cytogenetic Giemsa G-banding CanvasTexture with alternating dark
 * heterochromatin and pale euchromatin transverse bands plus fine fibrous
 * chromatin micro-texture.
 */
export function useGiemsaTexture(
  baseHex: string,
  bandHex: string,
  accentHex: string,
  seed = 1
) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 512);

    // Alternating cytogenetic G-bands along chromatid length
    const bands = [
      { h: 36, y: 24 },
      { h: 24, y: 84 },
      { h: 48, y: 128 },
      { h: 28, y: 204 },
      { h: 44, y: 274 },
      { h: 30, y: 342 },
      { h: 52, y: 394 },
      { h: 26, y: 468 },
    ] as const;

    Arr.forEach(bands, (band, idx) => {
      const grad = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
      grad.addColorStop(0, baseHex);
      grad.addColorStop(0.22, idx % 3 === 0 ? accentHex : bandHex);
      grad.addColorStop(0.78, idx % 3 === 0 ? accentHex : bandHex);
      grad.addColorStop(1, baseHex);
      ctx.fillStyle = grad;
      ctx.fillRect(0, band.y, 256, band.h);
    });

    // Fine coiled chromatin fibril texture lines
    const white = getColor("WHITE");
    ctx.globalAlpha = 0.16;
    for (const i of Arr.range(0, 140)) {
      const y = hashUnit(seed + i, 3) * 512;
      const x = hashUnit(seed + i, 7) * 256;
      const w = 18 + hashUnit(seed + i, 11) * 44;
      ctx.fillStyle = i % 2 === 0 ? bandHex : white;
      ctx.fillRect(x, y, w, 2);
    }
    ctx.globalAlpha = 1;

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, [accentHex, baseHex, bandHex, seed]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

/**
 * Builds a single organic tapered chromatid arm profile (from pinched
 * centromere waist to rounded telomere tip) as a smooth LatheGeometry with
 * subtle longitudinal chromatin undulations.
 */
function createChromatidArmGeometry(
  length: number,
  radius: number,
  seed: number
) {
  const steps = 28;
  const pts = Arr.map(Arr.range(0, steps), (i) => {
    const t = i / steps;
    const y = t * length;
    let profile = 1;
    if (t < 0.12) {
      profile = 0.42 + (t / 0.12) * 0.58;
    } else if (t > 0.84) {
      const u = (t - 0.84) / 0.16;
      profile = Math.sqrt(Math.max(0.002, 1 - u * u));
    } else {
      profile =
        0.95 +
        0.09 * Math.sin(t * Math.PI * 5 + seed) +
        0.05 * Math.cos(t * Math.PI * 9);
    }
    return new Vector2(Math.max(0.002, radius * profile), y);
  });
  return new LatheGeometry(pts, 32);
}

/**
 * One sculpted chromatid arm (p-arm or q-arm) with organic chromatin silhouette,
 * Giemsa banding texture, waxy clearcoat sheen, and protective telomere cap.
 */
export function ChromatidArm({
  accentColor = GENETICS_COLORS.giemsaMid,
  bandColor = GENETICS_COLORS.giemsaDark,
  baseColor = GENETICS_COLORS.giemsaLight,
  emissive,
  emissiveIntensity = 0,
  length = 0.46,
  position = [0, 0, 0],
  radius = 0.088,
  rotation = [0, 0, 0],
  seed = 1,
  showTelomere = true,
  telomereColor = GENETICS_COLORS.telomereCap,
}: {
  readonly accentColor?: string;
  readonly bandColor?: string;
  readonly baseColor?: string;
  readonly emissive?: string | undefined;
  readonly emissiveIntensity?: number;
  readonly length?: number;
  readonly position?: readonly [number, number, number];
  readonly radius?: number;
  readonly rotation?: readonly [number, number, number];
  readonly seed?: number;
  readonly showTelomere?: boolean;
  readonly telomereColor?: string;
}) {
  const armGeo = useMemo(
    () => createChromatidArmGeometry(length, radius, seed),
    [length, radius, seed]
  );
  const tex = useGiemsaTexture(baseColor, bandColor, accentColor, seed);

  useEffect(() => () => armGeo.dispose(), [armGeo]);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow geometry={armGeo} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.48}
          clearcoatRoughness={0.32}
          color={tex === null ? baseColor : getColor("WHITE")}
          emissive={emissive ?? baseColor}
          emissiveIntensity={emissive === undefined ? 0 : emissiveIntensity}
          map={tex}
          roughness={0.44}
        />
      </mesh>
      {showTelomere ? (
        <mesh castShadow position={[0, length - radius * 0.48, 0]}>
          <sphereGeometry
            args={[radius * 0.74, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56]}
          />
          <meshPhysicalMaterial
            clearcoat={0.72}
            color={telomereColor}
            emissive={telomereColor}
            emissiveIntensity={0.2}
            roughness={0.28}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * Full paired X-shaped metaphase chromosome composed of two sculpted Giemsa-banded
 * sister chromatids joined at a constricted golden kinetochore centromere, with
 * distinct short p-arms, long q-arms, and luminous telomere caps.
 */
export function MetaphaseChromosome({
  accentColor = GENETICS_COLORS.giemsaMid,
  bandColor = GENETICS_COLORS.giemsaDark,
  baseColor = GENETICS_COLORS.giemsaLight,
  pLength = 0.36,
  position = [0, 0, 0],
  qLength = 0.48,
  radius = 0.088,
  rotation = [0, 0, 0],
  scale = 1,
  seed = 1,
  splay = 0.26,
}: {
  readonly accentColor?: string;
  readonly bandColor?: string;
  readonly baseColor?: string;
  readonly pLength?: number;
  readonly position?: readonly [number, number, number];
  readonly qLength?: number;
  readonly radius?: number;
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number;
  readonly seed?: number;
  readonly splay?: number;
}) {
  const tex = useGiemsaTexture(baseColor, bandColor, accentColor, seed);
  const { pGeo, qGeo } = useMemo(
    () => ({
      pGeo: createChromatidArmGeometry(pLength, radius, seed),
      qGeo: createChromatidArmGeometry(qLength, radius, seed + 3),
    }),
    [pLength, qLength, radius, seed]
  );

  useEffect(
    () => () => {
      pGeo.dispose();
      qGeo.dispose();
    },
    [pGeo, qGeo]
  );

  const armPlacements = [
    {
      geo: pGeo,
      id: "lp",
      len: pLength,
      pos: [-radius * 0.48, 0.02, 0] as const,
      rotZ: splay,
    },
    {
      geo: qGeo,
      id: "lq",
      len: qLength,
      pos: [-radius * 0.48, -0.02, 0] as const,
      rotZ: Math.PI - splay,
    },
    {
      geo: pGeo,
      id: "rp",
      len: pLength,
      pos: [radius * 0.48, 0.02, 0] as const,
      rotZ: -splay,
    },
    {
      geo: qGeo,
      id: "rq",
      len: qLength,
      pos: [radius * 0.48, -0.02, 0] as const,
      rotZ: Math.PI + splay,
    },
  ] as const;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Arr.map(armPlacements, (arm) => (
        <group key={arm.id} position={arm.pos} rotation={[0, 0, arm.rotZ]}>
          <mesh castShadow geometry={arm.geo} receiveShadow>
            <meshPhysicalMaterial
              clearcoat={0.48}
              clearcoatRoughness={0.32}
              color={tex === null ? baseColor : getColor("WHITE")}
              map={tex}
              roughness={0.44}
            />
          </mesh>
          <mesh castShadow position={[0, arm.len - radius * 0.48, 0]}>
            <sphereGeometry
              args={[radius * 0.74, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56]}
            />
            <meshPhysicalMaterial
              clearcoat={0.72}
              color={GENETICS_COLORS.telomereCap}
              emissive={GENETICS_COLORS.telomereCap}
              emissiveIntensity={0.2}
              roughness={0.28}
            />
          </mesh>
        </group>
      ))}

      {/* Constricted kinetochore centromere collar & lateral protein plaques */}
      <mesh castShadow scale={[1.28, 0.68, 0.96]}>
        <sphereGeometry args={[radius * 0.96, 26, 20]} />
        <meshPhysicalMaterial
          clearcoat={0.72}
          clearcoatRoughness={0.22}
          color={GENETICS_COLORS.kinetochoreGold}
          metalness={0.42}
          roughness={0.28}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 1.08, radius * 0.16, 12, 36]} />
        <MetalMaterial
          color={GENETICS_COLORS.kinetochoreGold}
          roughness={0.24}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          key={side}
          position={[side * radius * 1.18, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[radius * 0.42, radius * 0.48, radius * 0.24, 18]}
          />
          <MetalMaterial
            color={GENETICS_COLORS.brassPolished}
            roughness={0.26}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Miniature banded X (submetacentric) and Y (small acrocentric) karyotype
 * chromosome specimens mounted on brass-rimmed glass display discs.
 */
export function KaryotypeDisplay({
  position = [0, 0.16, 0],
}: {
  readonly position?: readonly [number, number, number];
}) {
  return (
    <group position={position}>
      <MetaphaseChromosome
        accentColor={GENETICS_COLORS.xChromosome}
        bandColor={GENETICS_COLORS.maternalDark}
        baseColor={GENETICS_COLORS.maternalLight}
        pLength={0.14}
        position={[-0.28, 0.08, 0]}
        qLength={0.18}
        radius={0.036}
        seed={14}
        splay={0.25}
      />
      <MetaphaseChromosome
        accentColor={GENETICS_COLORS.yChromosome}
        bandColor={GENETICS_COLORS.paternalDark}
        baseColor={GENETICS_COLORS.paternalLight}
        pLength={0.065}
        position={[0.28, 0.05, 0]}
        qLength={0.115}
        radius={0.032}
        seed={27}
        splay={0.22}
      />
    </group>
  );
}
