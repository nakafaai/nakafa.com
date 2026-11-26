import { leafBlade } from "@repo/design-system/components/contents/biology/flora";
import {
  FelineSpecimen,
  SunBearSpecimen,
  TapirSpecimen,
} from "@repo/design-system/components/contents/biology/taxon/mammals";
import type { TaxonOrganism } from "@repo/design-system/components/contents/biology/taxon/model";
import { CLASSIFICATION_COLORS } from "@repo/design-system/lib/material/classification";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Procedural iridescent emerald-and-velvet-black Rajah Brooke's birdwing butterfly wing texture. */
function createBirdwingTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.fillStyle = CLASSIFICATION_COLORS.birdwingBlack;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = CLASSIFICATION_COLORS.birdwingGreen;
    for (let i = 0; i < 7; i += 1) {
      const y = 32 + i * 28;
      ctx.beginPath();
      ctx.moveTo(46, y);
      ctx.lineTo(192 - i * 10, y - 10);
      ctx.lineTo(170 - i * 10, y + 11);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Sculpted Rhinoceros Hornbill with glossy black plumage, white banded tail, decurved bill, and upturned crimson casque. */
function HornbillSpecimen() {
  const { beakGeo, casqueGeo, wingGeo } = useMemo(() => {
    const beak = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.03, 0.01, 0),
        new Vector3(0.14, 0.018, 0),
        new Vector3(0.24, -0.03, 0),
      ]),
      14,
      0.026,
      10,
      false
    );
    const casque = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.03, 0.042, 0),
        new Vector3(0.11, 0.056, 0),
        new Vector3(0.15, 0.095, 0),
      ]),
      12,
      0.022,
      10,
      false
    );
    const wingShape = new Shape();
    wingShape.moveTo(0, 0.06);
    wingShape.bezierCurveTo(-0.08, 0.04, -0.18, -0.05, -0.22, -0.15);
    wingShape.bezierCurveTo(-0.1, -0.14, -0.02, -0.05, 0.04, 0.02);
    wingShape.closePath();
    const wing = new ExtrudeGeometry(wingShape, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.006,
      bevelThickness: 0.006,
      depth: 0.018,
    });
    return { beakGeo: beak, casqueGeo: casque, wingGeo: wing };
  }, []);

  useEffect(
    () => () => {
      beakGeo.dispose();
      casqueGeo.dispose();
      wingGeo.dispose();
    },
    [beakGeo, casqueGeo, wingGeo]
  );

  return (
    <group>
      <mesh castShadow position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.026, 0.24, 12]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.gardenTimber}
          roughness={0.85}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.18, 0]}
        rotation={[0, 0, -0.35]}
        scale={[0.92, 1.38, 0.85]}
      >
        <sphereGeometry args={[0.088, 18, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.35}
          color={CLASSIFICATION_COLORS.hornbillPlumage}
          roughness={0.38}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          castShadow
          geometry={wingGeo}
          key={`hb-wing-${side}`}
          position={[0.02, 0.2, side * 0.068]}
        >
          <meshPhysicalMaterial
            clearcoat={0.32}
            color={CLASSIFICATION_COLORS.hornbillPlumage}
            roughness={0.4}
          />
        </mesh>
      ))}
      <group position={[-0.12, 0.09, 0]} rotation={[0, 0, 0.65]}>
        <mesh castShadow>
          <boxGeometry args={[0.04, 0.2, 0.065]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.hornbillTail}
            roughness={0.62}
          />
        </mesh>
        <mesh position={[0, -0.04, 0]}>
          <boxGeometry args={[0.043, 0.055, 0.068]} />
          <meshStandardMaterial
            color={CLASSIFICATION_COLORS.hornbillPlumage}
            roughness={0.48}
          />
        </mesh>
      </group>
      <group position={[0.06, 0.31, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.054, 16, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.35}
            color={CLASSIFICATION_COLORS.hornbillPlumage}
            roughness={0.38}
          />
        </mesh>
        <mesh castShadow geometry={beakGeo}>
          <meshPhysicalMaterial
            clearcoat={0.55}
            color={CLASSIFICATION_COLORS.hornbillBeak}
            roughness={0.32}
          />
        </mesh>
        <mesh castShadow geometry={casqueGeo}>
          <meshPhysicalMaterial
            clearcoat={0.62}
            color={CLASSIFICATION_COLORS.hornbillCasque}
            roughness={0.28}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Sculpted Rajah Brooke's Birdwing butterfly with veined iridescent emerald-and-black swallowtail wings. */
function BirdwingSpecimen() {
  const { wingGeo, wingMat, wingTex } = useMemo(() => {
    const tex = createBirdwingTexture();
    const mat = new MeshPhysicalMaterial({
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
      map: tex,
      roughness: 0.36,
      sheen: 0.72,
      sheenColor: CLASSIFICATION_COLORS.birdwingGreen,
      sheenRoughness: 0.35,
    });
    const shape = new Shape();
    shape.moveTo(0, 0.02);
    shape.bezierCurveTo(0.08, 0.14, 0.2, 0.16, 0.24, 0.09);
    shape.bezierCurveTo(0.22, 0.02, 0.15, -0.02, 0.12, -0.04);
    shape.bezierCurveTo(0.14, -0.1, 0.08, -0.15, 0.02, -0.12);
    shape.lineTo(0, -0.04);
    shape.closePath();
    const geo = new ExtrudeGeometry(shape, {
      bevelEnabled: false,
      depth: 0.005,
    });
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) {
      const u = Math.min(1, Math.max(0, uv.getX(i) / 0.24));
      const v = Math.min(1, Math.max(0, (uv.getY(i) + 0.15) / 0.31));
      uv.setXY(i, u, v);
    }
    return { wingGeo: geo, wingMat: mat, wingTex: tex };
  }, []);

  useEffect(
    () => () => {
      wingGeo.dispose();
      wingMat.dispose();
      wingTex.dispose();
    },
    [wingGeo, wingMat, wingTex]
  );

  return (
    <group position={[0, 0.2, 0]} rotation={[0.62, 0, 0]} scale={1.38}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.018, 0.12, 8, 12]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.birdwingBlack}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[0, 0, 0.048]}>
        <torusGeometry args={[0.02, 0.008, 8, 14]} />
        <meshStandardMaterial
          color={CLASSIFICATION_COLORS.hornbillCasque}
          roughness={0.5}
        />
      </mesh>
      <mesh
        castShadow
        geometry={wingGeo}
        material={wingMat}
        position={[0.01, 0, 0]}
        rotation={[-Math.PI / 2, 0.28, 0]}
      />
      <mesh
        castShadow
        geometry={wingGeo}
        material={wingMat}
        position={[-0.01, 0, 0]}
        rotation={[-Math.PI / 2, -0.28, 0]}
        scale={[-1, 1, 1]}
      />
    </group>
  );
}

/** Sculpted arching paddy rice clump with botanical leaf blades and drooping golden grain panicles. */
function PadiSpecimen() {
  const { foliageGeo, panicles } = useMemo(() => {
    const base = new Color(CLASSIFICATION_COLORS.padiLeaf);
    const tip = new Color(CLASSIFICATION_COLORS.leafFresh);
    const blades = Arr.makeBy(8, (i) => {
      const a = (i / 8) * Math.PI * 2;
      return leafBlade(
        new Vector3(Math.cos(a) * 0.025, 0, Math.sin(a) * 0.025),
        a,
        0.3 + (i % 3) * 0.06,
        0.26 + (i % 2) * 0.06,
        0.032,
        0.14,
        6,
        base,
        tip
      );
    });
    const stalks = Arr.makeBy(4, (i) => {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const curve = new CatmullRomCurve3([
        new Vector3(dx * 0.015, 0, dz * 0.015),
        new Vector3(dx * 0.045, 0.22, dz * 0.045),
        new Vector3(dx * 0.12, 0.34, dz * 0.12),
        new Vector3(dx * 0.18, 0.29, dz * 0.18),
      ]);
      const grains = Arr.makeBy(6, (g) => {
        const pt = curve.getPoint(0.58 + (g / 5) * 0.4);
        return { id: `g-${i}-${g}`, pos: [pt.x, pt.y, pt.z] as const };
      });
      return {
        grains,
        id: `p-${i}`,
        stalk: new TubeGeometry(curve, 14, 0.008, 6, false),
      };
    });
    return { foliageGeo: mergeGeometries(blades), panicles: stalks };
  }, []);

  useEffect(
    () => () => {
      foliageGeo.dispose();
      for (const p of panicles) {
        p.stalk.dispose();
      }
    },
    [foliageGeo, panicles]
  );

  return (
    <group scale={1.32}>
      <mesh castShadow geometry={foliageGeo}>
        <meshPhysicalMaterial
          clearcoat={0.22}
          roughness={0.54}
          side={2}
          vertexColors
        />
      </mesh>
      {Arr.map(panicles, (p) => (
        <group key={p.id}>
          <mesh castShadow geometry={p.stalk}>
            <meshStandardMaterial
              color={CLASSIFICATION_COLORS.padiLeaf}
              roughness={0.62}
            />
          </mesh>
          {Arr.map(p.grains, (grain) => (
            <mesh
              castShadow
              key={grain.id}
              position={grain.pos}
              scale={[1.35, 0.8, 0.8]}
            >
              <sphereGeometry args={[0.015, 8, 6]} />
              <meshPhysicalMaterial
                clearcoat={0.25}
                color={CLASSIFICATION_COLORS.padiHusk}
                roughness={0.44}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** High-detail wildlife and botanical specimen figurine for TaxonRankLab. */
export function TaxonSpecimenFigurine({
  organism,
}: {
  readonly organism: TaxonOrganism;
}) {
  return Match.value(organism).pipe(
    Match.when("tiger", () => <FelineSpecimen kind="tiger" scale={1.12} />),
    Match.when("leopard", () => <FelineSpecimen kind="leopard" scale={1.04} />),
    Match.when("leopardCat", () => (
      <FelineSpecimen kind="leopardCat" scale={0.86} />
    )),
    Match.when("sunBear", () => <SunBearSpecimen />),
    Match.when("tapir", () => <TapirSpecimen />),
    Match.when("hornbill", () => <HornbillSpecimen />),
    Match.when("birdwing", () => <BirdwingSpecimen />),
    Match.when("padi", () => <PadiSpecimen />),
    Match.exhaustive
  );
}
