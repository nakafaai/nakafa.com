import type { Insect } from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ExtrudeGeometry,
  LatheGeometry,
  MeshPhysicalMaterial,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

const EGG_OFFSETS = [
  { id: "e0", pos: [0, 0.03, 0] as const },
  { id: "e1", pos: [0.075, 0.025, 0.045] as const },
  { id: "e2", pos: [-0.07, 0.025, 0.05] as const },
  { id: "e3", pos: [0.02, 0.025, -0.072] as const },
] as const;

/** Procedural monarch butterfly wing texture with black veins and white marginal spots. */
function createMonarchWingTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    ctx.fillStyle = PLOT_COLORS.orange;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = BIOLOGY_COLORS.microscopeBlack;
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, size - 12, size - 12);
    // Radiating dark wing veins.
    ctx.lineWidth = 6;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(12, size * 0.55);
      ctx.quadraticCurveTo(
        size * 0.5,
        size * (0.12 + i * 0.16),
        size - 10,
        size * (0.08 + i * 0.17)
      );
      ctx.stroke();
    }
    // White marginal border spots.
    ctx.fillStyle = BIOLOGY_COLORS.bubble;
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.arc(size - 16, 22 + i * 30, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Sculpted realistic egg clutch, segmented larva/nymph, chrysalis pupa, and winged adult butterfly/grasshopper. */
export function MetamorphosisOrganism({
  insect,
  instar,
  stage,
}: {
  readonly insect: Insect;
  readonly instar: number;
  readonly stage: "adult" | "egg" | "larva" | "nymph" | "pupa";
}) {
  const geos = useMemo(() => {
    // Ribbed oval insect egg.
    const eggPts = Arr.map(Arr.range(0, 14), (s) => {
      const t = s / 14;
      const r = Math.max(0.002, Math.sin(t * Math.PI) ** 0.7 * 0.044);
      return new Vector2(r, t * 0.11);
    });
    const egg = new LatheGeometry(eggPts, 18);

    // 10-segment continuous caterpillar / nymph body with ringed bands.
    const larvaPts = Arr.map(Arr.range(0, 44), (s) => {
      const t = s / 44;
      const taper = Math.sin(t * Math.PI) ** 0.42;
      const seg = 1 - 0.1 * Math.abs(Math.sin(t * Math.PI * 10));
      return new Vector2(
        Math.max(0.004, 0.082 * taper * seg),
        (t - 0.5) * 0.52
      );
    });
    const larva = new LatheGeometry(larvaPts, 24);
    larva.rotateZ(-Math.PI / 2);
    const lPos = larva.getAttribute("position");
    const lCols = new Float32Array(lPos.count * 3);
    const bandA = new Color(
      insect === "grasshopper" ? BOTANY_COLORS.healthyLeaf : PLOT_COLORS.amber
    );
    const bandB = new Color(
      insect === "grasshopper"
        ? BOTANY_COLORS.sepalGreen
        : BIOLOGY_COLORS.microscopeBlack
    );
    const tmp = new Color();
    for (let i = 0; i < lPos.count; i += 1) {
      const vx = lPos.getX(i);
      const t = Math.min(1, Math.max(0, vx / 0.52 + 0.5));
      const stripe = Math.sin(t * Math.PI * 20) > 0.35 ? 1 : 0;
      tmp
        .copy(bandA)
        .lerp(bandB, stripe * (insect === "butterfly" ? 0.85 : 0.3));
      lCols[i * 3] = tmp.r;
      lCols[i * 3 + 1] = tmp.g;
      lCols[i * 3 + 2] = tmp.b;
    }
    larva.setAttribute("color", new BufferAttribute(lCols, 3));
    larva.computeVertexNormals();

    // Sculpted chrysalis pupa with golden ridge keel and abdominal segments.
    const pupaPts = Arr.map(Arr.range(0, 26), (s) => {
      const t = s / 26;
      const profile =
        Math.sin(t * Math.PI) ** 0.65 *
        (1 + 0.16 * Math.exp(-(((t - 0.62) / 0.18) ** 2))) *
        (1 - 0.04 * Math.abs(Math.sin(t * Math.PI * 7)));
      return new Vector2(Math.max(0.004, 0.11 * profile), (t - 0.5) * 0.38);
    });
    const pupa = new LatheGeometry(pupaPts, 22);
    pupa.rotateZ(-Math.PI / 2);

    // Sculpted monarch butterfly wing with normalized [0,1] UVs.
    const wingShape = new Shape();
    wingShape.moveTo(0, 0.02);
    wingShape.bezierCurveTo(0.12, 0.2, 0.3, 0.24, 0.36, 0.12);
    wingShape.bezierCurveTo(0.34, 0.01, 0.24, -0.02, 0.2, -0.06);
    wingShape.bezierCurveTo(0.24, -0.14, 0.16, -0.22, 0.04, -0.18);
    wingShape.lineTo(0, -0.05);
    wingShape.closePath();
    const butterflyWing = new ExtrudeGeometry(wingShape, {
      bevelEnabled: false,
      depth: 0.006,
    });
    const uv = butterflyWing.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(
        i,
        Math.min(1, Math.max(0, uv.getX(i) / 0.36)),
        Math.min(1, Math.max(0, (uv.getY(i) + 0.22) / 0.46))
      );
    }

    const wingTex = createMonarchWingTexture();
    const wingMat = new MeshPhysicalMaterial({
      clearcoat: 0.35,
      map: wingTex,
      roughness: 0.42,
      sheen: 0.45,
      sheenColor: PLOT_COLORS.amber,
      sheenRoughness: 0.5,
    });

    const antenna = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.08, 0.06, 0.04),
        new Vector3(0.16, 0.09, 0.07),
      ]),
      10,
      0.006,
      6,
      false
    );

    return { antenna, butterflyWing, egg, larva, pupa, wingMat, wingTex };
  }, [insect]);

  useEffect(
    () => () => {
      geos.egg.dispose();
      geos.larva.dispose();
      geos.pupa.dispose();
      geos.butterflyWing.dispose();
      geos.antenna.dispose();
      geos.wingMat.dispose();
      geos.wingTex.dispose();
    },
    [geos]
  );

  if (stage === "egg") {
    return (
      <group>
        {Arr.map(EGG_OFFSETS, (item) => (
          <mesh
            castShadow
            geometry={geos.egg}
            key={item.id}
            position={item.pos}
          >
            <meshPhysicalMaterial
              clearcoat={0.78}
              clearcoatRoughness={0.18}
              color={BIOLOGY_COLORS.seed}
              roughness={0.28}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (stage === "larva" || stage === "nymph") {
    return (
      <group position={[0, 0.07, 0]}>
        <mesh castShadow geometry={geos.larva} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.42}
            roughness={0.42}
            vertexColors
          />
        </mesh>
        {/* Hard chitin head capsule + antennae */}
        <mesh castShadow position={[0.26, 0.015, 0]}>
          <sphereGeometry args={[0.074, 18, 14]} />
          <meshPhysicalMaterial
            clearcoat={0.62}
            color={BIOLOGY_COLORS.cork}
            roughness={0.32}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            geometry={geos.antenna}
            key={`l-ant-${side}`}
            position={[0.31, 0.04, side * 0.025]}
            scale={[0.7, 0.7, side * 0.7]}
          >
            <meshStandardMaterial
              color={BIOLOGY_COLORS.microscopeBlack}
              roughness={0.45}
            />
          </mesh>
        ))}
        {/* Growing wing pads on late-instar grasshopper nymphs */}
        {insect === "grasshopper" && instar >= 3
          ? Arr.map([-1, 1] as const, (side) => (
              <mesh
                castShadow
                key={`pad-${side}`}
                position={[0.04, 0.068, side * 0.052]}
                rotation={[side * 0.25, 0, -0.18]}
                scale={[0.38, 0.32, 0.22]}
              >
                <sphereGeometry args={[0.22, 14, 10]} />
                <meshPhysicalMaterial
                  clearcoat={0.4}
                  color={BOTANY_COLORS.windGreen}
                  roughness={0.42}
                />
              </mesh>
            ))
          : null}
      </group>
    );
  }

  if (stage === "pupa") {
    return (
      <group position={[0, 0.1, 0]}>
        <mesh castShadow geometry={geos.pupa} receiveShadow>
          <meshPhysicalMaterial
            clearcoat={0.68}
            clearcoatRoughness={0.2}
            color={BOTANY_COLORS.windGreen}
            roughness={0.3}
          />
        </mesh>
        {/* Characteristic golden chrysalis metallic spots along thorax ridge */}
        {Arr.map([-0.06, 0.02, 0.09] as const, (x) => (
          <mesh key={`gold-${x}`} position={[x, 0.095, 0.042]}>
            <sphereGeometry args={[0.014, 10, 8]} />
            <meshStandardMaterial
              color={BOTANY_COLORS.antherGold}
              metalness={0.78}
              roughness={0.22}
            />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group position={[0, 0.12, 0]}>
      {/* Adult thorax + segmented abdomen + head + antennae */}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.042, 0.28, 12, 18]} />
        <meshPhysicalMaterial
          clearcoat={0.42}
          color={
            insect === "grasshopper"
              ? BOTANY_COLORS.stemGreen
              : BIOLOGY_COLORS.microscopeBlack
          }
          roughness={0.4}
        />
      </mesh>
      <mesh castShadow position={[0.19, 0.015, 0]}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshPhysicalMaterial
          clearcoat={0.55}
          color={
            insect === "grasshopper"
              ? BOTANY_COLORS.sepalGreen
              : BIOLOGY_COLORS.microscopeBlack
          }
          roughness={0.34}
        />
      </mesh>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          geometry={geos.antenna}
          key={`a-ant-${side}`}
          position={[0.22, 0.03, side * 0.02]}
          scale={[0.85, 0.85, side * 0.85]}
        >
          <meshStandardMaterial
            color={BIOLOGY_COLORS.microscopeBlack}
            roughness={0.45}
          />
        </mesh>
      ))}
      {/* Sculpted wings */}
      {insect === "butterfly" ? (
        <group>
          <mesh
            castShadow
            geometry={geos.butterflyWing}
            material={geos.wingMat}
            position={[0.02, 0.03, 0.02]}
            rotation={[-Math.PI * 0.3, 0.22, 0]}
          />
          <mesh
            castShadow
            geometry={geos.butterflyWing}
            material={geos.wingMat}
            position={[0.02, 0.03, -0.02]}
            rotation={[Math.PI * 0.3, 0.22, Math.PI]}
            scale={[1, -1, 1]}
          />
        </group>
      ) : (
        Arr.map([-1, 1] as const, (side) => (
          <mesh
            castShadow
            key={`gh-wing-${side}`}
            position={[-0.04, 0.045, side * 0.055]}
            rotation={[side * 0.22, 0, -0.08]}
            scale={[1.8, 0.25, 0.42]}
          >
            <sphereGeometry args={[0.14, 16, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.48}
              color={BOTANY_COLORS.windGreen}
              opacity={0.86}
              roughness={0.32}
              transparent
            />
          </mesh>
        ))
      )}
    </group>
  );
}
