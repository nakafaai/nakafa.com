import { lumpAt } from "@repo/design-system/components/contents/biology/cell/lump";
import { Lump } from "@repo/design-system/components/contents/biology/cell/organic";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
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

    // G-bands of uneven width and depth, each with a ragged edge
    const bands = [
      { h: 30, y: 26 },
      { h: 16, y: 86 },
      { h: 44, y: 130 },
      { h: 20, y: 206 },
      { h: 38, y: 276 },
      { h: 24, y: 344 },
      { h: 46, y: 396 },
      { h: 18, y: 470 },
    ] as const;

    Arr.forEach(bands, (band, idx) => {
      ctx.fillStyle = idx % 3 === 0 ? accentHex : bandHex;
      for (const column of Arr.range(0, 63)) {
        const ragged = (hashUnit(seed + idx * 64 + column, 5) - 0.5) * 12;
        const depth = 0.2 + hashUnit(seed + idx, 13) * 0.24;
        for (const pass of Arr.range(0, 3)) {
          ctx.globalAlpha = depth / 4;
          ctx.fillRect(
            column * 4,
            band.y + ragged - pass * 3,
            4,
            band.h + pass * 6
          );
        }
      }
    });

    // The grain of looped chromatin: fine darker specks
    for (const i of Arr.range(0, 1800)) {
      const size = 1.5 + hashUnit(seed + i, 11) * 3.5;
      ctx.globalAlpha = 0.04 + hashUnit(seed + i, 17) * 0.09;
      ctx.fillStyle = bandHex;
      ctx.beginPath();
      ctx.arc(
        hashUnit(seed + i, 7) * 256,
        hashUnit(seed + i, 3) * 512,
        size,
        0,
        Math.PI * 2
      );
      ctx.fill();
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
 * One chromatid arm from its pinched waist at the centromere to its rounded
 * telomere: the chromatin fibre coiled into a condensed rod, so its gyres
 * wind around it and its surface is knobbly with packed loops, as a scanning
 * electron micrograph shows a metaphase chromosome. No arm is quite straight
 * and none is a smooth tube.
 */
function createChromatidArmGeometry(
  length: number,
  radius: number,
  seed: number
) {
  const steps = 56;
  const cap = Math.min(0.3, radius / length);
  const waist = Math.min(0.3, (radius * 1.2) / length);
  const pts = Arr.map(Arr.range(0, steps), (i) => {
    const t = i / steps;
    let profile = 1;
    if (t < waist) {
      const u = t / waist;
      profile = 0.55 + 0.45 * u * u * (3 - 2 * u);
    } else if (t > 1 - cap) {
      const u = (t - (1 - cap)) / cap;
      profile = Math.sqrt(Math.max(0.0004, 1 - u * u));
    }
    return new Vector2(Math.max(0.002, radius * profile), t * length);
  });
  const arm = new LatheGeometry(pts, 48);
  const place = arm.getAttribute("position");
  for (let index = 0; index < place.count; index += 1) {
    const x = place.getX(index);
    const y = place.getY(index);
    const z = place.getZ(index);
    const gyre =
      1 + 0.085 * Math.sin(Math.atan2(z, x) + (y / radius) * 4.4 + seed);
    const swell =
      gyre *
      lumpAt(x / radius, (y / radius) * 0.9, z / radius, seed, 0.14) *
      lumpAt(
        (x / radius) * 3.1,
        (y / radius) * 3.1,
        (z / radius) * 3.1,
        seed + 5,
        0.06
      );
    const bend = radius * (y / length) ** 2;
    place.setXYZ(
      index,
      x * swell + Math.sin(seed * 1.3) * 0.5 * bend,
      y,
      z * swell + Math.cos(seed * 2.1) * 0.3 * bend
    );
  }
  arm.computeVertexNormals();
  return arm;
}

/** The matt, velvety surface of condensed chromatin, with its banding and its grain in relief. */
function ChromatinMaterial({
  baseColor,
  texture,
}: {
  readonly baseColor: string;
  readonly texture: CanvasTexture | null;
}) {
  return (
    <meshPhysicalMaterial
      bumpMap={texture}
      bumpScale={1}
      color={texture === null ? baseColor : getColor("WHITE")}
      map={texture}
      roughness={0.86}
    />
  );
}

/**
 * One sculpted chromatid arm (p-arm or q-arm) with organic chromatin silhouette,
 * Giemsa banding texture, waxy clearcoat sheen, and protective telomere cap.
 */
export function ChromatidArm({
  accentColor = GENETICS_COLORS.giemsaMid,
  bandColor = GENETICS_COLORS.giemsaDark,
  baseColor = GENETICS_COLORS.giemsaLight,
  length = 0.46,
  position = [0, 0, 0],
  radius = 0.088,
  rotation = [0, 0, 0],
  seed = 1,
}: {
  readonly accentColor?: string;
  readonly bandColor?: string;
  readonly baseColor?: string;
  readonly length?: number;
  readonly position?: readonly [number, number, number];
  readonly radius?: number;
  readonly rotation?: readonly [number, number, number];
  readonly seed?: number;
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
        <ChromatinMaterial baseColor={baseColor} texture={tex} />
      </mesh>
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
      pos: [-radius * 0.48, 0.02, 0] as const,
      rotZ: splay,
    },
    {
      geo: qGeo,
      id: "lq",
      pos: [-radius * 0.48, -0.02, 0] as const,
      rotZ: Math.PI - splay,
    },
    {
      geo: pGeo,
      id: "rp",
      pos: [radius * 0.48, 0.02, 0] as const,
      rotZ: -splay,
    },
    {
      geo: qGeo,
      id: "rq",
      pos: [radius * 0.48, -0.02, 0] as const,
      rotZ: Math.PI + splay,
    },
  ] as const;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Arr.map(armPlacements, (arm) => (
        <group key={arm.id} position={arm.pos} rotation={[0, 0, arm.rotZ]}>
          <mesh castShadow geometry={arm.geo} receiveShadow>
            <ChromatinMaterial baseColor={baseColor} texture={tex} />
          </mesh>
        </group>
      ))}

      {/* The primary constriction, and a kinetochore plaque on each chromatid's outer face */}
      <Lump
        coat={0.05}
        color={bandColor}
        depth={0.16}
        radius={radius * 0.8}
        seed={seed + 1}
        stretch={[1.25, 0.62, 0.92]}
      />
      {Arr.map([-1, 1] as const, (side) => (
        <Lump
          coat={0.1}
          color={GENETICS_COLORS.kinetochoreGold}
          depth={0.2}
          key={side}
          position={[side * radius * 1.02, 0, 0]}
          radius={radius * 0.5}
          seed={seed + 3 + side}
          stretch={[0.42, 0.9, 0.9]}
        />
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
