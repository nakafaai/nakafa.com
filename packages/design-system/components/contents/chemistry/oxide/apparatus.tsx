import { ColumnLiquid } from "@repo/design-system/components/contents/chemistry/bench";
import type { PeriodOxide } from "@repo/design-system/components/contents/chemistry/oxide/model";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import type { Path } from "@repo/design-system/components/three/form/path";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo } from "react";
import type { Group } from "three";
import { CanvasTexture, ExtrudeGeometry, Shape, SRGBColorSpace } from "three";

export const BEAKER_X = -0.105;
export const BEAKER_Z = 0.065;
export const METER_X = -0.275;
export const METER_Z = -0.045;
const PROBE_X = BEAKER_X + 0.024;

/** The coaxial lead from the pH meter over to its electrode in the beaker. */
const CABLE: Path = [
  [METER_X + 0.032, 0.135, METER_Z],
  [METER_X + 0.075, 0.215, METER_Z + 0.025],
  [PROBE_X - 0.04, 0.242, BEAKER_Z - 0.012],
  [PROBE_X, 0.198, BEAKER_Z],
];

/** The glass delivery tube that bubbles gas into the beaker, in the beaker's own frame. */
const SPARGER: Path = [
  [-0.072, 0.155, -0.022],
  [-0.022, 0.145, -0.006],
  [-0.014, 0.105, 0],
  [-0.014, 0.028, 0],
];

const BEAKER_250_WALL = [
  [0, 0],
  [0.044, 0],
  [0.048, 0.0045],
  [0.048, 0.095],
  [0.0512, 0.0995],
  [0.0492, 0.101],
  [0.0454, 0.095],
  [0.0454, 0.0055],
  [0.042, 0.0042],
  [0, 0.0042],
] as const;

const SAMPLE_GRANULES = [
  { id: "g-0", r: 0.0115, x: -0.014, y: 0.017, z: 0.008 },
  { id: "g-1", r: 0.0095, x: -0.004, y: 0.016, z: -0.009 },
  { id: "g-2", r: 0.0105, x: -0.021, y: 0.015, z: -0.006 },
  { id: "g-3", r: 0.0082, x: -0.011, y: 0.026, z: 0.001 },
  { id: "g-4", r: 0.0078, x: 0.002, y: 0.015, z: 0.011 },
] as const;

export const REACTION_BUBBLES = [
  { id: "b-0", offset: 0, x: -0.015, z: 0.006 },
  { id: "b-1", offset: 0.25, x: -0.004, z: -0.008 },
  { id: "b-2", offset: 0.5, x: -0.02, z: -0.004 },
  { id: "b-3", offset: 0.75, x: -0.008, z: 0.01 },
] as const;

const METER_FEET = [
  [-0.048, -0.036],
  [0.048, -0.036],
  [-0.048, 0.036],
  [0.048, 0.036],
] as const;

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

function createPhLcdTexture(
  ph: number,
  indicatorColor: string
): CanvasTexture | null {
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
  ctx.fillStyle = BENCH_COLORS.lcd;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = BENCH_COLORS.balanceFrame;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 240);

  ctx.fillStyle = indicatorColor;
  ctx.fillRect(24, 24, 464, 22);

  ctx.fillStyle = BENCH_COLORS.lcdInk;
  ctx.font = "700 94px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`pH ${ph.toFixed(1)}`, 256, 154);

  ctx.font = "600 30px ui-monospace, monospace";
  ctx.fillText("25.0 °C   ATC   HOLD", 256, 218);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createPhMeterBodyGeometry() {
  const side = new Shape();
  side.moveTo(-0.052, 0);
  side.lineTo(0.052, 0);
  side.lineTo(0.052, 0.048);
  side.lineTo(0.018, 0.128);
  side.lineTo(-0.052, 0.128);
  side.closePath();
  const geo = new ExtrudeGeometry(side, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.0035,
    bevelThickness: 0.0035,
    depth: 0.122,
  });
  geo.translate(0, 0, -0.061);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

/** Benchtop digital pH meter with backlit LCD, tactile buttons, coaxial lead, and glass-bulb electrode. */
export function BenchPhMeter({
  indicatorColor,
  ph,
}: {
  readonly indicatorColor: string;
  readonly ph: number;
}) {
  const bodyGeo = useMemo(createPhMeterBodyGeometry, []);
  const lcdTex = useMemo(
    () => createPhLcdTexture(ph, indicatorColor),
    [indicatorColor, ph]
  );
  useEffect(() => () => bodyGeo.dispose(), [bodyGeo]);
  useEffect(() => () => lcdTex?.dispose(), [lcdTex]);

  return (
    <group>
      {/* Benchtop digital console */}
      <group position={[METER_X, 0, METER_Z]} rotation={[0, 0.22, 0]}>
        {Arr.map(METER_FEET, ([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 0.003, z]}>
            <cylinderGeometry args={[0.008, 0.009, 0.006, 16]} />
            <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.85} />
          </mesh>
        ))}
        <mesh
          castShadow
          geometry={bodyGeo}
          position={[0, 0.006, 0]}
          receiveShadow
        >
          <meshPhysicalMaterial
            clearcoat={0.28}
            color={BENCH_COLORS.meterBody}
            metalness={0.2}
            roughness={0.44}
          />
        </mesh>
        {/* Angled backlit LCD faceplate */}
        <group position={[0, 0.095, 0.041]} rotation={[-0.4, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.1, 0.056, 0.004]} />
            <MetalMaterial color={BENCH_COLORS.balanceBezel} roughness={0.4} />
          </mesh>
          {lcdTex === null ? null : (
            <mesh position={[0, 0.002, 0.0025]}>
              <planeGeometry args={[0.092, 0.046]} />
              <meshStandardMaterial
                emissive={BENCH_COLORS.lcdHalo}
                emissiveIntensity={0.22}
                map={lcdTex}
                roughness={0.34}
              />
            </mesh>
          )}
        </group>
        {/* Tactile calibration and mode keys */}
        {Arr.map([-0.032, 0, 0.032] as const, (kx, idx) => (
          <mesh key={kx} position={[kx, 0.042, 0.055]} rotation={[0.42, 0, 0]}>
            <boxGeometry args={[0.02, 0.006, 0.012]} />
            <meshStandardMaterial
              color={
                idx === 0
                  ? BENCH_COLORS.balanceKeyTare
                  : BENCH_COLORS.balanceKey
              }
              roughness={0.45}
            />
          </mesh>
        ))}
        {/* BNC probe connector */}
        <mesh position={[0.032, 0.138, 0]}>
          <cylinderGeometry args={[0.006, 0.0068, 0.016, 18]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
      </group>

      {/* Curved coaxial electrode lead */}
      <mesh castShadow>
        <Sweep path={CABLE} radius={0.0028} />
        <meshStandardMaterial color={BENCH_COLORS.leadBlack} roughness={0.55} />
      </mesh>

      {/* Articulated chrome stand arm + combination glass-bulb pH electrode */}
      <group position={[PROBE_X, 0, BEAKER_Z]}>
        {/* Retort rod behind beaker */}
        <mesh castShadow position={[0.046, 0.118, -0.056]}>
          <cylinderGeometry args={[0.0042, 0.0042, 0.236, 16]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.2} />
        </mesh>
        <mesh position={[0.046, 0.006, -0.056]} receiveShadow>
          <cylinderGeometry args={[0.022, 0.026, 0.012, 24]} />
          <MetalMaterial color={CAR_COLORS.castIron} roughness={0.55} />
        </mesh>
        <mesh
          castShadow
          position={[0.023, 0.172, -0.028]}
          rotation={[0, -0.88, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.0032, 0.0032, 0.072, 14]} />
          <MetalMaterial color={CAR_COLORS.chrome} roughness={0.22} />
        </mesh>
        <mesh castShadow position={[0, 0.172, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 0.014, 18]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
        {/* Probe top cap */}
        <mesh castShadow position={[0, 0.184, 0]}>
          <cylinderGeometry args={[0.0075, 0.0082, 0.03, 18]} />
          <meshStandardMaterial
            color={BENCH_COLORS.meterBody}
            roughness={0.45}
          />
        </mesh>
        {/* Probe epoxy shaft */}
        <mesh castShadow position={[0, 0.118, 0]}>
          <cylinderGeometry args={[0.0056, 0.0056, 0.112, 18]} />
          <meshPhysicalMaterial
            clearcoat={0.45}
            color={CAR_COLORS.dashboard}
            roughness={0.32}
          />
        </mesh>
        {/* Translucent KCl reference junction & glass sensing bulb dipped in solution */}
        <mesh position={[0, 0.052, 0]}>
          <cylinderGeometry args={[0.0052, 0.0044, 0.022, 18]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.42} />
        </mesh>
        <mesh position={[0, 0.039, 0]}>
          <sphereGeometry args={[0.0052, 16, 12]} />
          <GlassMaterial color={PROCESS_COLORS.silicaBlue} opacity={0.58} />
        </mesh>
      </group>
    </group>
  );
}

/** 250 mL graduated borosilicate reaction beaker with universal indicator meniscus, oxide sample, and bubbles. */
export function ReactionBeakerStation({
  bubblesRef,
  liquidColor,
  oxide,
}: {
  readonly bubblesRef: RefObject<Group | null>;
  readonly liquidColor: string;
  readonly oxide: PeriodOxide;
}) {
  const markings = useMemo(createBeakerScaleTexture, []);
  useEffect(() => () => markings?.dispose(), [markings]);

  const isGas = oxide === "so2";
  const isReactive = oxide === "na2o" || oxide === "p4o10" || oxide === "so2";

  return (
    <group position={[BEAKER_X, 0, BEAKER_Z]}>
      {/* Glazed ceramic bench tile */}
      <mesh castShadow position={[0, 0.004, 0]} receiveShadow>
        <boxGeometry args={[0.132, 0.008, 0.132]} />
        <meshPhysicalMaterial
          clearcoat={0.28}
          color={BENCH_COLORS.ceramicTile}
          roughness={0.48}
        />
      </mesh>
      <group position={[0, 0.008, 0]}>
        <ColumnLiquid
          bottom={0.005}
          color={liquidColor}
          level={0.072}
          opacity={0.72}
          radius={0.0445}
        />

        {/* Oxide specimen: either crystalline solid granules or SO₂ gas delivery sparger */}
        {isGas ? (
          <mesh castShadow renderOrder={2}>
            <Sweep ends="open" path={SPARGER} radius={0.0036} />
            <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.48} />
          </mesh>
        ) : (
          <group>
            {Arr.map(SAMPLE_GRANULES, (g) => (
              <mesh
                castShadow
                key={g.id}
                position={[g.x, g.y, g.z]}
                rotation={[g.x * 40, g.z * 35, 0.4]}
              >
                <dodecahedronGeometry args={[g.r, 0]} />
                <meshPhysicalMaterial
                  clearcoat={oxide === "sio2" ? 0.65 : 0.12}
                  color={
                    oxide === "sio2"
                      ? PROCESS_COLORS.silicaBlue
                      : PROCESS_COLORS.ceramicIvory
                  }
                  roughness={oxide === "sio2" ? 0.22 : 0.72}
                />
              </mesh>
            ))}
          </group>
        )}

        {/* Rising reaction/dissolution micro-bubbles for reactive oxides */}
        {isReactive ? (
          <group ref={bubblesRef}>
            {Arr.map(REACTION_BUBBLES, (b) => (
              <mesh key={b.id} position={[b.x, 0.025 + b.offset * 0.044, b.z]}>
                <sphereGeometry args={[0.0032, 12, 10]} />
                <GlassMaterial
                  color={BENCH_COLORS.streamGlint}
                  opacity={0.78}
                />
              </mesh>
            ))}
          </group>
        ) : null}

        {/* Borosilicate beaker glass wall, pouring rim, and white enamel graduations */}
        <mesh castShadow renderOrder={2}>
          <Turn profile={BEAKER_250_WALL} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.26} />
        </mesh>
        <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.0496, 0.0014, 10, 56]} />
          <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.58} />
        </mesh>
        {markings === null ? null : (
          <mesh
            position={[0, 0.05, 0]}
            renderOrder={3}
            rotation={[0, -Math.PI, 0]}
          >
            <cylinderGeometry args={[0.0484, 0.0484, 0.074, 44, 1, true]} />
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
