import { useFrame } from "@react-three/fiber";
import { buildStemGeometry } from "@repo/design-system/components/contents/biology/botanical";
import {
  createBotanicalCanvas,
  finalizeBotanicalTexture,
} from "@repo/design-system/components/contents/biology/foliage";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  BufferAttribute,
  Color,
  DoubleSide,
  LatheGeometry,
  MeshPhysicalMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from "three";

export const INSECT_LEG_PAIRS = [
  { id: "l1", rx: 0.04, x: 0.032, zSign: 1 },
  { id: "l2", rx: 0.04, x: 0.032, zSign: -1 },
  { id: "l3", rx: 0, x: 0.005, zSign: 1 },
  { id: "l4", rx: 0, x: 0.005, zSign: -1 },
  { id: "l5", rx: -0.05, x: -0.025, zSign: 1 },
  { id: "l6", rx: -0.05, x: -0.025, zSign: -1 },
] as const;

function createHoverflyWingTexture() {
  const col = createBotanicalCanvas(256);
  const alpha = createBotanicalCanvas(256);

  if (col.ctx !== null && alpha.ctx !== null) {
    const grad = col.ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, SPECIMEN_COLORS.hoverflyWingA);
    grad.addColorStop(0.5, SPECIMEN_COLORS.hoverflyWingB);
    grad.addColorStop(1, SPECIMEN_COLORS.hoverflyWingC);
    col.ctx.fillStyle = grad;
    col.ctx.fillRect(0, 0, 256, 256);

    alpha.ctx.fillStyle = SPECIMEN_COLORS.alphaBase;
    alpha.ctx.fillRect(0, 0, 256, 256);

    col.ctx.strokeStyle = SPECIMEN_COLORS.hoverflyWingVein;
    alpha.ctx.strokeStyle = SPECIMEN_COLORS.bumpWhite;
    const veins = [
      [8, 128, 128, 36, 248, 72],
      [8, 128, 124, 96, 244, 118],
      [8, 128, 118, 152, 232, 174],
      [8, 128, 96, 198, 188, 224],
      [115, 72, 138, 118, 152, 152],
      [172, 92, 184, 136, 192, 168],
    ] as const;
    for (const [x0, y0, cx, cy, x1, y1] of veins) {
      col.ctx.lineWidth = x0 < 20 ? 5 : 3;
      col.ctx.beginPath();
      col.ctx.moveTo(x0, y0);
      col.ctx.quadraticCurveTo(cx, cy, x1, y1);
      col.ctx.stroke();

      alpha.ctx.lineWidth = x0 < 20 ? 6 : 4;
      alpha.ctx.beginPath();
      alpha.ctx.moveTo(x0, y0);
      alpha.ctx.quadraticCurveTo(cx, cy, x1, y1);
      alpha.ctx.stroke();
    }
  }

  return {
    alphaMap: finalizeBotanicalTexture(alpha.canvas, false),
    map: finalizeBotanicalTexture(col.canvas, true),
  };
}

/**
 * Anatomically detailed flying prey hoverfly/wasp insect: segmented head with
 * large faceted reddish-brown compound eyes, curved antennae, dark chitin
 * thorax, gold-and-black banded tapered abdomen, 6 jointed legs, and paired
 * veined iridescent translucent wings that flutter smoothly during playback.
 */
export function HoverflyPrey({
  playing = false,
}: {
  readonly playing?: boolean;
}) {
  const leftWingRef = useRef<Group>(null);
  const rightWingRef = useRef<Group>(null);
  const flapRef = useRef(0);

  const assets = useMemo(() => {
    const abdPts = Arr.map(Arr.range(0, 26), (s) => {
      const t = s / 26;
      const envelope = Math.sin(t * Math.PI) ** 0.56 * (1 - 0.18 * (1 - t));
      const seg = 1 - 0.05 * Math.abs(Math.sin(t * Math.PI * 6));
      return new Vector2(
        Math.max(0.002, 0.036 * envelope * seg),
        (t - 0.5) * 0.14
      );
    });
    const abdomen = new LatheGeometry(abdPts, 24);
    abdomen.rotateZ(Math.PI / 2);
    const pos = abdomen.getAttribute("position");
    const cols = new Float32Array(pos.count * 3);
    const gold = new Color(SPECIMEN_COLORS.hoverflyGold);
    const dark = new Color(SPECIMEN_COLORS.hoverflyDark);
    const c = new Color();
    for (let i = 0; i < pos.count; i += 1) {
      const t = Math.min(1, Math.max(0, pos.getX(i) / 0.14 + 0.5));
      const band = Math.sin(t * Math.PI * 10) > 0.15 ? 1 : 0;
      c.copy(dark).lerp(gold, band);
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    abdomen.setAttribute("color", new BufferAttribute(cols, 3));
    abdomen.computeVertexNormals();

    const wShape = new Shape();
    wShape.moveTo(0, 0);
    wShape.bezierCurveTo(0.03, 0.032, 0.11, 0.038, 0.15, 0.012);
    wShape.bezierCurveTo(0.155, -0.014, 0.1, -0.032, 0.04, -0.018);
    wShape.closePath();
    const wing = new ShapeGeometry(wShape, 18);
    const uv = wing.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(
        i,
        Math.min(1, Math.max(0, uv.getX(i) / 0.155)),
        Math.min(1, Math.max(0, (uv.getY(i) + 0.032) / 0.07))
      );
    }

    const wingTex = createHoverflyWingTexture();
    const wingMat = new MeshPhysicalMaterial({
      alphaMap: wingTex.alphaMap,
      clearcoat: 0.9,
      iridescence: 0.85,
      iridescenceIOR: 1.38,
      map: wingTex.map,
      opacity: 0.82,
      roughness: 0.14,
      side: DoubleSide,
      transparent: true,
    });

    const antenna = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.022, 0.018, 0.012),
        new Vector3(0.042, 0.024, 0.024),
      ],
      0.0026,
      0.0012,
      8,
      6
    );
    const leg = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.006, -0.018, 0.026),
        new Vector3(-0.008, -0.046, 0.034),
        new Vector3(0.006, -0.062, 0.04),
      ],
      0.0032,
      0.0014,
      10,
      6
    );

    return { abdomen, antenna, leg, wing, wingMat, wingTex };
  }, []);

  useEffect(
    () => () => {
      assets.abdomen.dispose();
      assets.antenna.dispose();
      assets.leg.dispose();
      assets.wing.dispose();
      assets.wingMat.dispose();
      assets.wingTex.map.dispose();
      assets.wingTex.alphaMap.dispose();
    },
    [assets]
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    flapRef.current += simulationStep(delta) * 34;
    const flap = Math.sin(flapRef.current) * 0.42;
    if (leftWingRef.current !== null) {
      leftWingRef.current.rotation.x = 0.58 + flap;
    }
    if (rightWingRef.current !== null) {
      rightWingRef.current.rotation.x = -0.58 - flap;
    }
  });

  return (
    <group>
      <mesh castShadow geometry={assets.abdomen} position={[-0.072, -0.006, 0]}>
        <meshPhysicalMaterial
          clearcoat={0.62}
          clearcoatRoughness={0.22}
          roughness={0.32}
          vertexColors
        />
      </mesh>
      <mesh castShadow position={[0.022, 0.006, 0]} scale={[1.18, 0.96, 0.92]}>
        <sphereGeometry args={[0.034, 18, 14]} />
        <meshPhysicalMaterial
          clearcoat={0.35}
          color={SPECIMEN_COLORS.hoverflyThorax}
          roughness={0.44}
        />
      </mesh>
      <group position={[0.072, 0.008, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.024, 16, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.65}
            color={SPECIMEN_COLORS.hoverflyHead}
            roughness={0.28}
          />
        </mesh>
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            key={`eye-${side}`}
            position={[0.006, 0.005, side * 0.017]}
            scale={[0.92, 1.15, 0.72]}
          >
            <sphereGeometry args={[0.016, 14, 12]} />
            <meshPhysicalMaterial
              clearcoat={0.92}
              clearcoatRoughness={0.08}
              color={SPECIMEN_COLORS.hoverflyEye}
              roughness={0.16}
            />
          </mesh>
        ))}
        {Arr.map([-1, 1] as const, (side) => (
          <mesh
            geometry={assets.antenna}
            key={`ant-${side}`}
            position={[0.018, 0.01, side * 0.008]}
            scale={[1, 1, side]}
          >
            <meshStandardMaterial
              color={SPECIMEN_COLORS.hoverflyDark}
              roughness={0.42}
            />
          </mesh>
        ))}
      </group>
      {Arr.map(INSECT_LEG_PAIRS, (leg) => (
        <mesh
          geometry={assets.leg}
          key={leg.id}
          position={[leg.x, -0.016, leg.zSign * 0.016]}
          rotation={[0, leg.rx * leg.zSign, 0]}
          scale={[1, 1, leg.zSign]}
        >
          <meshStandardMaterial
            color={SPECIMEN_COLORS.hoverflyLeg}
            roughness={0.45}
          />
        </mesh>
      ))}
      <group
        position={[0.025, 0.032, 0.016]}
        ref={leftWingRef}
        rotation={[0.58, -0.35, 0.16]}
        scale={1.32}
      >
        <mesh
          castShadow
          geometry={assets.wing}
          material={assets.wingMat}
          rotation={[Math.PI / 2, 0, Math.PI * 0.72]}
        />
      </group>
      <group
        position={[0.025, 0.032, -0.016]}
        ref={rightWingRef}
        rotation={[-0.58, 0.35, 0.16]}
        scale={1.32}
      >
        <mesh
          castShadow
          geometry={assets.wing}
          material={assets.wingMat}
          rotation={[-Math.PI / 2, 0, Math.PI * 0.72]}
          scale={[1, -1, 1]}
        />
      </group>
    </group>
  );
}
