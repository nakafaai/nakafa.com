import { BotanicalLeaf } from "@repo/design-system/components/contents/biology/seedling";
import { Turn } from "@repo/design-system/components/three/form/part";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";

const ROOT_CAP_PROFILE = [
  [0, 0],
  [0.095, 0.03],
  [0.185, 0.11],
  [0.245, 0.24],
  [0.265, 0.34],
  [0.245, 0.36],
] as const;

const MERISTEM_CELLS = Arr.flatMap([-0.085, 0, 0.085] as const, (x) =>
  Arr.map([0.34, 0.43, 0.52] as const, (y) => ({
    id: `mc-${x}-${y}`,
    x,
    y,
  }))
);

const ELONGATION_CELLS = Arr.flatMap([-0.1, 0, 0.1] as const, (x) =>
  Arr.map([0.74, 0.94] as const, (y) => ({
    id: `ec-${x}-${y}`,
    x,
    y,
  }))
);

const ROOT_HAIR_SPECS = [
  { droop: -0.06, id: "rh1", len: 0.42, side: -1, y: 1.08, z: 0.04 },
  { droop: 0.04, id: "rh2", len: 0.48, side: 1, y: 1.15, z: -0.03 },
  { droop: -0.05, id: "rh3", len: 0.44, side: -1, y: 1.24, z: -0.04 },
  { droop: 0.02, id: "rh4", len: 0.38, side: 1, y: 1.32, z: 0.05 },
] as const;

/** Procedural wood cross-section texture with annual earlywood/latewood rings and medullary rays. */
function createWoodRingTexture(ringCount: number): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const size = 512;
  const cx = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = FOLIAGE_COLORS.annualEarly;
  ctx.fillRect(0, 0, size, size);

  const maxR = size * 0.48;
  for (let r = 1; r <= ringCount; r += 1) {
    const rad = (r / (ringCount + 0.4)) * maxR;
    ctx.strokeStyle = FOLIAGE_COLORS.annualLate;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cx, rad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = FOLIAGE_COLORS.stemWood;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cx, rad + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Fine radial medullary vascular rays
  ctx.strokeStyle = FOLIAGE_COLORS.annualLate;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 36; i += 1) {
    const ang = (i / 36) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.lineTo(cx + Math.cos(ang) * maxR, cx + Math.sin(ang) * maxR);
    ctx.stroke();
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Longitudinal cutaway of root apical meristem: mucilage cap, mitotic dome, vacuolating elongation cells, root hairs & spiral xylem. */
export function RootApexCutaway() {
  const { hairs, xylemSpiral } = useMemo(() => {
    const spiralPts = Arr.makeBy(36, (i) => {
      const t = i / 35;
      const ang = t * Math.PI * 10;
      return new Vector3(
        Math.cos(ang) * 0.048,
        0.92 + t * 0.52,
        Math.sin(ang) * 0.048
      );
    });
    const spiralGeo = new TubeGeometry(
      new CatmullRomCurve3(spiralPts),
      44,
      0.0085,
      6,
      false
    );
    const hairGeos = Arr.map(ROOT_HAIR_SPECS, (spec) => {
      const curve = new CatmullRomCurve3([
        new Vector3(spec.side * 0.22, spec.y, -0.02 + spec.z),
        new Vector3(
          spec.side * (0.22 + spec.len * 0.45),
          spec.y + spec.droop * 0.4,
          0.02 + spec.z
        ),
        new Vector3(
          spec.side * (0.22 + spec.len),
          spec.y + spec.droop * 1.4,
          -0.01 + spec.z
        ),
      ]);
      return {
        geo: new TubeGeometry(curve, 14, 0.013, 8, false),
        id: spec.id,
      };
    });
    return { hairs: hairGeos, xylemSpiral: spiralGeo };
  }, []);

  useEffect(
    () => () => {
      xylemSpiral.dispose();
      Arr.forEach(hairs, (h) => h.geo.dispose());
    },
    [hairs, xylemSpiral]
  );

  return (
    <group>
      {/* Back half-cylinder cortex & epidermis cutaway (open cleanly toward +Z camera) */}
      <mesh castShadow position={[0, 0.88, 0]} receiveShadow>
        <cylinderGeometry
          args={[0.27, 0.24, 1.18, 36, 1, false, Math.PI * 0.5, Math.PI]}
        />
        <meshPhysicalMaterial
          clearcoat={0.28}
          color={FOLIAGE_COLORS.epidermis}
          roughness={0.54}
          side={DoubleSide}
        />
      </mesh>
      {/* Translucent mucilaginous root cap thimble wrapping the lower apex */}
      <mesh castShadow position={[0, 0.04, 0]}>
        <Turn
          arc={[Math.PI * 0.48, Math.PI * 1.04]}
          profile={ROOT_CAP_PROFILE}
        />
        <meshPhysicalMaterial
          clearcoat={0.65}
          color={FOLIAGE_COLORS.rootCap}
          opacity={0.86}
          roughness={0.44}
          side={DoubleSide}
          transparent
        />
      </mesh>
      {/* Dividing meristematic cells with visible purple mitotic chromatin */}
      {Arr.map(MERISTEM_CELLS, (cell) => (
        <group key={cell.id} position={[cell.x, cell.y, 0.04]}>
          <mesh castShadow>
            <boxGeometry args={[0.072, 0.072, 0.075]} />
            <meshPhysicalMaterial
              clearcoat={0.35}
              color={FOLIAGE_COLORS.meristemCell}
              opacity={0.88}
              roughness={0.36}
              transparent
            />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <sphereGeometry args={[0.022, 12, 10]} />
            <meshStandardMaterial
              color={FOLIAGE_COLORS.mitoticChromatin}
              roughness={0.42}
            />
          </mesh>
        </group>
      ))}
      {/* Elongation zone stretched parenchyma cells with expanding translucent vacuoles */}
      {Arr.map(ELONGATION_CELLS, (cell) => (
        <group key={cell.id} position={[cell.x, cell.y, 0.04]}>
          <mesh castShadow>
            <boxGeometry args={[0.082, 0.175, 0.08]} />
            <meshPhysicalMaterial
              color={FOLIAGE_COLORS.parenchyma}
              opacity={0.52}
              roughness={0.4}
              transparent
            />
          </mesh>
          <mesh position={[0, 0, 0.015]}>
            <capsuleGeometry args={[0.028, 0.09, 8, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.8}
              color={FOLIAGE_COLORS.vacuole}
              opacity={0.86}
              roughness={0.18}
              transparent
            />
          </mesh>
        </group>
      ))}
      {/* Central spiral lignified xylem vessel in differentiation zone */}
      <mesh castShadow geometry={xylemSpiral}>
        <meshStandardMaterial
          color={BOTANY_COLORS.ligninBrown}
          roughness={0.52}
        />
      </mesh>
      {/* Curved epidermal root hairs */}
      {Arr.map(hairs, (hair) => (
        <mesh castShadow geometry={hair.geo} key={hair.id}>
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={FOLIAGE_COLORS.rootHair}
            opacity={0.88}
            roughness={0.32}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/** Longitudinal cutaway of shoot apical meristem with curving veined leaf primordia. */
export function ShootApexCutaway() {
  return (
    <group>
      <mesh castShadow position={[0, 0.78, 0]} receiveShadow>
        <cylinderGeometry
          args={[0.26, 0.28, 1.18, 36, 1, false, Math.PI * 0.5, Math.PI]}
        />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={FOLIAGE_COLORS.palisade}
          roughness={0.48}
          side={DoubleSide}
        />
      </mesh>
      {/* Apical meristematic dome */}
      <mesh castShadow position={[0, 1.36, 0]}>
        <sphereGeometry
          args={[0.22, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55]}
        />
        <meshPhysicalMaterial
          clearcoat={0.45}
          color={FOLIAGE_COLORS.meristemCell}
          roughness={0.36}
        />
      </mesh>
      {/* Flanking curving veined leaf primordia */}
      {Arr.map([-1, 1] as const, (side) => (
        <group key={`lp-${side}`}>
          <BotanicalLeaf
            baseColor={FOLIAGE_COLORS.spongy}
            droop={0.28}
            length={0.44}
            position={[side * 0.16, 1.24, 0.04]}
            rotation={[0, side === 1 ? 0 : Math.PI, 1.05]}
            veinColor={BOTANY_COLORS.healthyLeafVein}
            width={0.46}
          />
          <BotanicalLeaf
            baseColor={BOTANY_COLORS.healthyLeafDeep}
            droop={0.24}
            length={0.52}
            position={[side * 0.24, 1.02, 0.02]}
            rotation={[0, side === 1 ? 0.2 : Math.PI - 0.2, 0.72]}
            veinColor={BOTANY_COLORS.healthyLeafVein}
            width={0.52}
          />
        </group>
      ))}
      {/* Elongating vacuoles below the shoot dome */}
      {Arr.map(ELONGATION_CELLS, (cell) => (
        <mesh key={cell.id} position={[cell.x, cell.y - 0.05, 0.05]}>
          <capsuleGeometry args={[0.032, 0.1, 8, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.75}
            color={FOLIAGE_COLORS.vacuole}
            opacity={0.84}
            roughness={0.22}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/** Realistic woody dicot stem cross-section with furrowed bark, cambium rings, and annual wood grain. */
export function SecondaryWoodCrossSection({
  outerRadius,
  ringCount,
  xylemRadius,
}: {
  readonly outerRadius: number;
  readonly ringCount: number;
  readonly xylemRadius: number;
}) {
  const ringTex = useMemo(() => createWoodRingTexture(ringCount), [ringCount]);
  useEffect(() => () => ringTex?.dispose(), [ringTex]);

  return (
    <group position={[0, 0.42, 0]}>
      {/* Furrowed outer bark sheath */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[outerRadius, outerRadius * 1.04, 0.56, 40]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.barkBrown}
          roughness={0.92}
        />
      </mesh>
      {/* Cork cambium & secondary phloem collar */}
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry
          args={[outerRadius - 0.045, outerRadius - 0.045, 0.56, 40]}
        />
        <meshStandardMaterial color={FOLIAGE_COLORS.phloem} roughness={0.62} />
      </mesh>
      {/* Active green vascular cambium ring */}
      <mesh position={[0, 0.058, 0]}>
        <cylinderGeometry
          args={[xylemRadius + 0.028, xylemRadius + 0.028, 0.56, 40]}
        />
        <meshStandardMaterial color={FOLIAGE_COLORS.cambium} roughness={0.44} />
      </mesh>
      {/* Secondary xylem wood cylinder with textured annual growth rings */}
      <mesh position={[0, 0.072, 0]}>
        <cylinderGeometry args={[xylemRadius, xylemRadius, 0.56, 44]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.annualEarly}
          roughness={0.66}
        />
      </mesh>
      <mesh position={[0, 0.354, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[xylemRadius, 48]} />
        <meshStandardMaterial
          color={FOLIAGE_COLORS.annualEarly}
          map={ringTex}
          roughness={0.62}
        />
      </mesh>
    </group>
  );
}
