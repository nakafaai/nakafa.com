import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  LatheGeometry,
  MeshPhysicalMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

const FELINE_LEGS = [
  { id: "fl", lx: 0.11, lz: 0.044 },
  { id: "fr", lx: 0.11, lz: -0.044 },
  { id: "bl", lx: -0.1, lz: 0.046 },
  { id: "br", lx: -0.1, lz: -0.046 },
] as const;

const BEAR_LEGS = [
  { id: "fl", lx: 0.11, lz: 0.062 },
  { id: "fr", lx: 0.11, lz: -0.062 },
  { id: "bl", lx: -0.1, lz: 0.064 },
  { id: "br", lx: -0.1, lz: -0.064 },
] as const;

const TAPIR_LEGS = [
  { id: "fl", lx: 0.12, lz: 0.056 },
  { id: "fr", lx: 0.12, lz: -0.056 },
  { id: "bl", lx: -0.12, lz: 0.058 },
  { id: "br", lx: -0.12, lz: -0.058 },
] as const;

function drawTigerStripes(ctx: CanvasRenderingContext2D, size: number) {
  ctx.fillStyle = CLASSIFICATION_COLORS.tigerStripe;
  for (let i = 0; i < 11; i += 1) {
    const x = (i + 0.4) * (size / 11);
    ctx.beginPath();
    ctx.moveTo(x - 6, 0);
    ctx.quadraticCurveTo(x + 9, size * 0.35, x - 2, size * 0.78);
    ctx.lineTo(x + 5, size * 0.78);
    ctx.quadraticCurveTo(x + 15, size * 0.35, x + 4, 0);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLeopardSpots(
  ctx: CanvasRenderingContext2D,
  size: number,
  isLeopard: boolean
) {
  const count = isLeopard ? 42 : 64;
  const radius = isLeopard ? 8.5 : 5;
  ctx.strokeStyle = CLASSIFICATION_COLORS.leopardSpot;
  ctx.lineWidth = isLeopard ? 3.2 : 2.2;
  for (let i = 0; i < count; i += 1) {
    const cx = ((i * 53 + 17) % (size - 20)) + 10;
    const cy = ((i * 37 + 11) % Math.floor(size * 0.72)) + 8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0.2, Math.PI * 1.8);
    ctx.stroke();
  }
}

/** Procedural big-cat coat texture (tiger stripes, leopard rosettes, or leopard-cat spots). */
function createFelineCoatTexture(kind: "leopard" | "leopardCat" | "tiger") {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.fillStyle =
      kind === "tiger"
        ? CLASSIFICATION_COLORS.tigerOrange
        : CLASSIFICATION_COLORS.leopardGold;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = CLASSIFICATION_COLORS.tigerCream;
    for (let band = 0; band < 5; band += 1) {
      ctx.globalAlpha = (band + 1) * 0.18;
      const y = size * (0.65 + band * 0.07);
      ctx.fillRect(0, y, size, size * 0.08);
    }
    ctx.globalAlpha = 1;

    if (kind === "tiger") {
      drawTigerStripes(ctx, size);
    } else {
      drawLeopardSpots(ctx, size, kind === "leopard");
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Sculpted feline figurine with sinuous torso, 4 legs, sculpted head/ears, curved tail, and coat markings. */
export function FelineSpecimen({
  kind,
  scale = 1,
}: {
  readonly kind: "leopard" | "leopardCat" | "tiger";
  readonly scale?: number;
}) {
  const { coatMat, coatTex, legGeo, tailGeo, torsoGeo } = useMemo(() => {
    const tex = createFelineCoatTexture(kind);
    const mat = new MeshPhysicalMaterial({
      map: tex,
      roughness: 0.68,
      sheen: 0.45,
      sheenColor: CLASSIFICATION_COLORS.tigerCream,
      sheenRoughness: 0.72,
    });
    const torsoPts = Arr.map(Arr.range(0, 18), (s) => {
      const t = s / 18;
      const chest = 1 + 0.16 * Math.exp(-(((t - 0.72) / 0.2) ** 2));
      const waist = 1 - 0.12 * Math.exp(-(((t - 0.45) / 0.15) ** 2));
      const r = Math.max(
        0.008,
        Math.sin(t * Math.PI) ** 0.55 * 0.082 * chest * waist
      );
      return new Vector2(r, (t - 0.5) * 0.34);
    });
    const torso = new LatheGeometry(torsoPts, 24);
    torso.rotateZ(-Math.PI / 2);

    const leg = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0.15, 0),
        new Vector3(0.015, 0.08, 0),
        new Vector3(0.005, 0.014, 0),
      ]),
      10,
      0.022,
      8,
      false
    );
    const tail = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.14, 0.17, 0),
        new Vector3(-0.23, 0.12, 0.02),
        new Vector3(-0.3, 0.16, 0.04),
        new Vector3(-0.33, 0.23, 0.03),
      ]),
      16,
      0.014,
      8,
      false
    );
    return {
      coatMat: mat,
      coatTex: tex,
      legGeo: leg,
      tailGeo: tail,
      torsoGeo: torso,
    };
  }, [kind]);

  useEffect(
    () => () => {
      coatMat.dispose();
      coatTex.dispose();
      torsoGeo.dispose();
      legGeo.dispose();
      tailGeo.dispose();
    },
    [coatMat, coatTex, legGeo, tailGeo, torsoGeo]
  );

  return (
    <group scale={scale}>
      <mesh
        castShadow
        geometry={torsoGeo}
        material={coatMat}
        position={[0, 0.18, 0]}
      />
      <mesh
        castShadow
        material={coatMat}
        position={[0.16, 0.22, 0]}
        rotation={[0, 0, -0.5]}
      >
        <cylinderGeometry args={[0.046, 0.058, 0.11, 14]} />
      </mesh>
      <group position={[0.21, 0.26, 0]}>
        <mesh castShadow material={coatMat} scale={[1.1, 0.92, 0.95]}>
          <sphereGeometry args={[0.064, 18, 14]} />
        </mesh>
        <mesh position={[0.058, -0.012, 0]} scale={[1, 0.72, 0.85]}>
          <sphereGeometry args={[0.032, 12, 10]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tigerCream}
            roughness={0.72}
          />
        </mesh>
        <mesh position={[0.088, -0.004, 0]}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tigerStripe}
            roughness={0.35}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={`ear-${side}`}
            material={coatMat}
            position={[-0.008, 0.058, side * 0.04]}
            scale={[0.6, 1.05, 0.9]}
          >
            <sphereGeometry args={[0.022, 10, 8]} />
          </mesh>
        ))}
      </group>
      {Arr.map(FELINE_LEGS, (leg) => (
        <group key={leg.id} position={[leg.lx, 0, leg.lz]}>
          <mesh castShadow geometry={legGeo} material={coatMat} />
          <mesh
            castShadow
            material={coatMat}
            position={[0.014, 0.016, 0]}
            scale={[1.35, 0.6, 1]}
          >
            <sphereGeometry args={[0.022, 10, 8]} />
          </mesh>
        </group>
      ))}
      <mesh castShadow geometry={tailGeo} material={coatMat} />
    </group>
  );
}

/** Sculpted Sun Bear with muscular shoulders, pale snout, golden chest crescent & foreclaws. */
export function SunBearSpecimen() {
  const { crescentGeo, torsoGeo } = useMemo(() => {
    const pts = Arr.map(Arr.range(0, 16), (s) => {
      const t = s / 16;
      const r = Math.max(0.01, Math.sin(t * Math.PI) ** 0.48 * 0.11);
      return new Vector2(r, (t - 0.5) * 0.34);
    });
    const torso = new LatheGeometry(pts, 24);
    torso.rotateZ(-Math.PI / 2);
    const crescent = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.145, 0.21, -0.045),
        new Vector3(0.168, 0.16, 0),
        new Vector3(0.145, 0.21, 0.045),
      ]),
      14,
      0.016,
      8,
      false
    );
    return { crescentGeo: crescent, torsoGeo: torso };
  }, []);

  useEffect(
    () => () => {
      torsoGeo.dispose();
      crescentGeo.dispose();
    },
    [crescentGeo, torsoGeo]
  );

  return (
    <group>
      <mesh castShadow geometry={torsoGeo} position={[0, 0.18, 0]}>
        <meshPhysicalMaterial
          color={CLASSIFICATION_COLORS.bearDark}
          roughness={0.78}
        />
      </mesh>
      <group position={[0.18, 0.25, 0]}>
        <mesh castShadow scale={[1.05, 0.95, 1]}>
          <sphereGeometry args={[0.078, 18, 14]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.bearDark}
            roughness={0.78}
          />
        </mesh>
        <mesh position={[0.068, -0.012, 0]} scale={[1.08, 0.82, 0.88]}>
          <sphereGeometry args={[0.04, 14, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.bearMuzzle}
            roughness={0.72}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh key={`bear-ear-${side}`} position={[-0.01, 0.068, side * 0.05]}>
            <sphereGeometry args={[0.02, 10, 8]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.bearDark}
              roughness={0.8}
            />
          </mesh>
        ))}
      </group>
      <mesh geometry={crescentGeo}>
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.bearChest}
          roughness={0.62}
        />
      </mesh>
      {Arr.map(BEAR_LEGS, (leg) => (
        <group key={leg.id} position={[leg.lx, 0, leg.lz]}>
          <mesh castShadow position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.032, 0.028, 0.16, 12]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.bearDark}
              roughness={0.8}
            />
          </mesh>
          <mesh position={[0.022, 0.014, 0]} scale={[1.3, 0.55, 1]}>
            <sphereGeometry args={[0.028, 10, 8]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.bearMuzzle}
              roughness={0.65}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Sculpted Malayan Tapir with curved proboscis snout, white-tipped ears, and crisp white saddle band. */
export function TapirSpecimen() {
  const { proboscisGeo, saddleGeo, torsoGeo } = useMemo(() => {
    const pts = Arr.map(Arr.range(0, 18), (s) => {
      const t = s / 18;
      const r = Math.max(0.01, Math.sin(t * Math.PI) ** 0.45 * 0.115);
      return new Vector2(r, (t - 0.5) * 0.4);
    });
    const torso = new LatheGeometry(pts, 26);
    torso.rotateZ(-Math.PI / 2);

    const saddlePts = Arr.map(Arr.range(0, 12), (s) => {
      const t = 0.25 + (s / 12) * 0.46;
      const r = Math.sin(t * Math.PI) ** 0.45 * 0.118;
      return new Vector2(r, (t - 0.5) * 0.4);
    });
    const saddle = new LatheGeometry(saddlePts, 26);
    saddle.rotateZ(-Math.PI / 2);

    const proboscis = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.04, 0.01, 0),
        new Vector3(0.095, -0.005, 0),
        new Vector3(0.125, -0.045, 0),
      ]),
      12,
      0.024,
      10,
      false
    );
    return { proboscisGeo: proboscis, saddleGeo: saddle, torsoGeo: torso };
  }, []);

  useEffect(
    () => () => {
      torsoGeo.dispose();
      saddleGeo.dispose();
      proboscisGeo.dispose();
    },
    [proboscisGeo, saddleGeo, torsoGeo]
  );

  return (
    <group>
      <mesh castShadow geometry={torsoGeo} position={[0, 0.19, 0]}>
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.tapirDark}
          roughness={0.74}
        />
      </mesh>
      <mesh castShadow geometry={saddleGeo} position={[0, 0.19, 0]}>
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.tapirLight}
          roughness={0.7}
        />
      </mesh>
      <group position={[0.21, 0.23, 0]}>
        <mesh castShadow scale={[1.25, 0.9, 0.85]}>
          <sphereGeometry args={[0.068, 16, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tapirDark}
            roughness={0.74}
          />
        </mesh>
        <mesh castShadow geometry={proboscisGeo}>
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tapirDark}
            roughness={0.68}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            key={`tapir-ear-${side}`}
            position={[-0.015, 0.066, side * 0.042]}
          >
            <sphereGeometry args={[0.02, 10, 8]} />
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.tapirLight}
              roughness={0.65}
            />
          </mesh>
        ))}
      </group>
      {Arr.map(TAPIR_LEGS, (leg) => (
        <mesh castShadow key={leg.id} position={[leg.lx, 0.085, leg.lz]}>
          <cylinderGeometry args={[0.028, 0.022, 0.17, 12]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.tapirDark}
            roughness={0.76}
          />
        </mesh>
      ))}
    </group>
  );
}
