import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import { latheProfile } from "@repo/design-system/components/contents/chemistry/glassware";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";

export const LEFT_BEAKER_X = -0.155;
export const RIGHT_BEAKER_X = 0.155;
export const BEAKER_Z = 0.06;
export const ANODE_X = LEFT_BEAKER_X - 0.022;
export const CATHODE_X = RIGHT_BEAKER_X + 0.022;
export const CLIP_Y = 0.144;

const LARGE_BEAKER_WALL = latheProfile([
  [0.001, 0],
  [0.044, 0],
  [0.048, 0.0045],
  [0.048, 0.092],
  [0.0512, 0.0965],
  [0.0492, 0.098],
  [0.0454, 0.092],
  [0.0454, 0.0055],
  [0.042, 0.0042],
  [0.001, 0.0042],
]);

function createBeakerScaleTexture(): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.clearRect(0, 0, 512, 256);
  ctx.shadowColor = BENCH_COLORS.glassMarkingShadow;
  ctx.shadowBlur = 2;
  ctx.strokeStyle = BENCH_COLORS.glassMarking;
  ctx.fillStyle = BENCH_COLORS.glassMarking;
  ctx.lineWidth = 4;
  ctx.font = "700 20px ui-sans-serif, system-ui, sans-serif";
  const ticks = [
    { label: "200", y: 50 },
    { label: "150", y: 96 },
    { label: "100", y: 142 },
    { label: "50", y: 188 },
  ] as const;
  Arr.forEach(ticks, (tick) => {
    ctx.beginPath();
    ctx.moveTo(212, tick.y);
    ctx.lineTo(266, tick.y);
    ctx.stroke();
    ctx.fillText(tick.label, 274, tick.y + 7);
  });
  ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("250 mL", 212, 26);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createElectrodeGeometry() {
  const halfW = 0.0115;
  const halfH = 0.055;
  const shape = new Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.0009,
    bevelThickness: 0.0009,
    depth: 0.0036,
  });
  geo.translate(0, 0, -0.0018);
  return geo;
}

/** Smooth 3D curve for the inverted borosilicate U-tube salt bridge between electrolytes. */
export function createSaltBridgeCurve() {
  const leftLegX = LEFT_BEAKER_X + 0.02;
  const rightLegX = RIGHT_BEAKER_X - 0.02;
  return new CatmullRomCurve3([
    new Vector3(leftLegX, 0.044, BEAKER_Z),
    new Vector3(leftLegX, 0.114, BEAKER_Z),
    new Vector3(leftLegX + 0.032, 0.148, BEAKER_Z),
    new Vector3(0, 0.156, BEAKER_Z),
    new Vector3(rightLegX - 0.032, 0.148, BEAKER_Z),
    new Vector3(rightLegX, 0.114, BEAKER_Z),
    new Vector3(rightLegX, 0.044, BEAKER_Z),
  ]);
}

/** Graduated borosilicate half-cell beaker on a white ceramic tile with electrolyte meniscus. */
export function HalfCellBeaker({
  liquidColor,
  liquidOpacity,
  x,
}: {
  readonly liquidColor: string;
  readonly liquidOpacity: number;
  readonly x: number;
}) {
  const beakerGeo = useMemo(() => new LatheGeometry(LARGE_BEAKER_WALL, 56), []);
  const markings = useMemo(createBeakerScaleTexture, []);
  useEffect(() => () => beakerGeo.dispose(), [beakerGeo]);
  useEffect(() => () => markings?.dispose(), [markings]);

  return (
    <group position={[x, 0, BEAKER_Z]}>
      {/* White ceramic bench pad */}
      <mesh castShadow position={[0, 0.004, 0]} receiveShadow>
        <boxGeometry args={[0.126, 0.008, 0.126]} />
        <meshPhysicalMaterial
          clearcoat={0.28}
          clearcoatRoughness={0.35}
          color={BENCH_COLORS.ceramicTile}
          roughness={0.48}
        />
      </mesh>
      {/* Electrolyte with concave meniscus */}
      <group position={[0, 0.008, 0]}>
        <ColumnLiquid
          bottom={0.005}
          color={liquidColor}
          level={0.068}
          opacity={liquidOpacity}
          radius={0.0445}
        />
        {/* Borosilicate beaker wall */}
        <mesh castShadow geometry={beakerGeo} renderOrder={2}>
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
        </mesh>
        <mesh position={[0, 0.0968, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.0496, 0.0014, 10, 56]} />
          <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.58} />
        </mesh>
        {markings === null ? null : (
          <mesh
            position={[0, 0.048, 0]}
            renderOrder={3}
            rotation={[0, -Math.PI, 0]}
          >
            <cylinderGeometry args={[0.0484, 0.0484, 0.072, 44, 1, true]} />
            <meshBasicMaterial
              depthWrite={false}
              map={markings}
              opacity={0.92}
              transparent
            />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Brushed bevelled metal electrode strip topped with an insulated crocodile clip and brass nut. */
export function ElectrodeAssembly({
  clipColor,
  metalColor,
  x,
}: {
  readonly clipColor: string;
  readonly metalColor: string;
  readonly x: number;
}) {
  const plateGeo = useMemo(createElectrodeGeometry, []);
  useEffect(() => () => plateGeo.dispose(), [plateGeo]);

  return (
    <group position={[x, 0, BEAKER_Z]}>
      {/* Brushed bevelled metallic electrode strip */}
      <mesh
        castShadow
        geometry={plateGeo}
        position={[0, 0.079, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <MetalMaterial color={metalColor} roughness={0.26} />
      </mesh>
      {/* Crocodile clip jaws */}
      <mesh castShadow position={[0, 0.135, 0]}>
        <boxGeometry args={[0.009, 0.014, 0.011]} />
        <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
      </mesh>
      {/* Insulated red or black clip sleeve */}
      <mesh castShadow position={[0, CLIP_Y + 0.002, 0]}>
        <cylinderGeometry args={[0.0058, 0.0068, 0.018, 16]} />
        <meshStandardMaterial color={clipColor} roughness={0.48} />
      </mesh>
      {/* Brass binding nut */}
      <mesh position={[0, CLIP_Y + 0.012, 0]}>
        <cylinderGeometry args={[0.0044, 0.0044, 0.005, 6]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>
    </group>
  );
}

/** Curved borosilicate inverted U-tube salt bridge with inner KNO3 agar gel and cotton-wool plugs. */
export function InvertedUTubeBridge() {
  const { gelGeo, glassGeo } = useMemo(() => {
    const curve = createSaltBridgeCurve();
    return {
      gelGeo: new TubeGeometry(curve, 64, 0.0072, 16, false),
      glassGeo: new TubeGeometry(curve, 64, 0.0096, 18, false),
    };
  }, []);
  useEffect(() => () => gelGeo.dispose(), [gelGeo]);
  useEffect(() => () => glassGeo.dispose(), [glassGeo]);

  const leftLegX = LEFT_BEAKER_X + 0.02;
  const rightLegX = RIGHT_BEAKER_X - 0.02;

  return (
    <group>
      {/* Translucent KNO3 agar gel inside U-tube */}
      <mesh geometry={gelGeo} renderOrder={1}>
        <meshPhysicalMaterial
          color={PROCESS_COLORS.saltBridgeWhite}
          depthWrite={false}
          opacity={0.42}
          roughness={0.35}
          transparent
        />
      </mesh>
      {/* Outer borosilicate glass U-tube */}
      <mesh castShadow geometry={glassGeo} renderOrder={2}>
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.32} />
      </mesh>
      {/* White cotton-wool plugs at both immersed tips */}
      {Arr.map([leftLegX, rightLegX] as const, (tipX) => (
        <mesh key={tipX} position={[tipX, 0.042, BEAKER_Z]}>
          <sphereGeometry args={[0.009, 14, 12]} />
          <meshStandardMaterial
            color={PROCESS_COLORS.ceramicIvory}
            roughness={0.94}
          />
        </mesh>
      ))}
    </group>
  );
}
