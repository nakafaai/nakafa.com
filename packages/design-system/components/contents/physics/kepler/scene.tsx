import { useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BLUE_MARBLE_EARTH_TEXTURE_ASSET } from "@repo/design-system/components/contents/biology/assets";
import type { OrbitingBody } from "@repo/design-system/components/contents/physics/kepler/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";

const SEMI_MAJOR = 1.25;

function createPlanetTexture(body: OrbitingBody): CanvasTexture | null {
  if (typeof document === "undefined" || body === "earth") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  const bands = Match.value(body).pipe(
    Match.when("jupiter", () => [
      QUANTUM_COLORS.jupiterBand1,
      QUANTUM_COLORS.jupiterBand2,
      QUANTUM_COLORS.jupiterBand3,
      QUANTUM_COLORS.jupiterBand2,
      QUANTUM_COLORS.jupiterBand3,
      QUANTUM_COLORS.jupiterBand1,
    ]),
    Match.when("mars", () => [
      QUANTUM_COLORS.mars,
      QUANTUM_COLORS.marsDark,
      QUANTUM_COLORS.marsLight,
      QUANTUM_COLORS.marsDark,
    ]),
    Match.when("venus", () => [
      QUANTUM_COLORS.venusBand1,
      QUANTUM_COLORS.venusBand2,
      QUANTUM_COLORS.venusBand1,
      QUANTUM_COLORS.venus,
    ]),
    Match.when("mercury", () => [
      QUANTUM_COLORS.mercury,
      QUANTUM_COLORS.mercuryDark,
      QUANTUM_COLORS.mercuryLight,
      QUANTUM_COLORS.mercuryDark,
    ]),
    Match.when("comet", () => [
      QUANTUM_COLORS.cometIon,
      QUANTUM_COLORS.glassRim,
      QUANTUM_COLORS.comet,
      QUANTUM_COLORS.neutron,
    ]),
    Match.exhaustive
  );
  const bandH = 128 / bands.length;
  Arr.forEach(bands, (fill, i) => {
    ctx.fillStyle = fill;
    ctx.fillRect(0, i * bandH, 256, bandH + 1);
  });
  if (body === "jupiter") {
    ctx.fillStyle = QUANTUM_COLORS.jupiterSpot;
    ctx.beginPath();
    ctx.ellipse(150, 82, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createOrbitTube(a: number, b: number): TubeGeometry {
  const pts = Arr.makeBy(96, (i) => {
    const theta = (i / 96) * Math.PI * 2;
    return new Vector3(a * Math.cos(theta), 0.24, b * Math.sin(theta));
  });
  return new TubeGeometry(new CatmullRomCurve3(pts, true), 120, 0.01, 8, true);
}

/**
 * Exact Kepler sector wedge anchored at the right focus `(c, 0)` spanning
 * eccentric anomaly `[u0, u1]`. Choosing intervals with equal swept area
 * visually proves Kepler's 2nd law (wide at perihelion, narrow at aphelion).
 */
function createSectorGeometry(
  a: number,
  b: number,
  c: number,
  u0: number,
  u1: number
): ShapeGeometry {
  const shape = new Shape();
  shape.moveTo(c, 0);
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const u = u0 + ((u1 - u0) * i) / steps;
    shape.lineTo(a * Math.cos(u), -b * Math.sin(u));
  }
  shape.closePath();
  return new ShapeGeometry(shape);
}

function PlanetMesh({
  body,
  radius,
}: {
  readonly body: OrbitingBody;
  readonly radius: number;
}) {
  const earthTex = useTexture(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
  const procTex = useMemo(() => createPlanetTexture(body), [body]);
  useEffect(() => () => procTex?.dispose(), [procTex]);

  const map = body === "earth" ? earthTex : procTex;

  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[radius, 36, 28]} />
        <meshStandardMaterial
          color={
            map === null ? QUANTUM_COLORS.earth : QUANTUM_COLORS.spaceLabel
          }
          map={map}
          roughness={body === "jupiter" || body === "venus" ? 0.55 : 0.72}
        />
      </mesh>
      {body === "earth" ? (
        <mesh>
          <sphereGeometry args={[radius * 1.07, 28, 20]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={QUANTUM_COLORS.earthAtmos}
            depthWrite={false}
            opacity={0.22}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  );
}

const STARS = Arr.makeBy(140, (index) => {
  const phi = Math.acos(1 - (2 * (index + 0.5)) / 140);
  const theta = Math.PI * (1 + Math.sqrt(5)) * index;
  const r = 7.5 + (index % 5) * 0.45;
  return {
    id: `s-${index}`,
    pos: [
      r * Math.sin(phi) * Math.cos(theta),
      Math.abs(r * Math.cos(phi)) - 1.5,
      r * Math.sin(phi) * Math.sin(theta),
    ] as const,
    size: 0.016 + (index % 3) * 0.009,
  };
});

function resolvePlanetRadius(body: OrbitingBody): number {
  if (body === "jupiter") {
    return 0.14;
  }
  if (body === "comet") {
    return 0.065;
  }
  return 0.1;
}

function KeplerCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 3.35, 3.95] : [0, 2.95, 3.45]}
      cameraTarget={[0, 0.22, 0]}
      fov={36}
      maxDistance={7.5}
      minDistance={1.6}
    />
  );
}

export function KeplerOrbitScene({
  body,
  eccentricity,
  parts,
}: {
  readonly body: OrbitingBody;
  readonly eccentricity: number;
  readonly parts: Readonly<
    Record<
      "aphelion" | "areaSector" | "focus" | "perihelion" | "planet" | "sun",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const planetRef = useRef<Group>(null);
  const tailRef = useRef<Group>(null);
  const anomalyRef = useRef(0.68);

  const a = SEMI_MAJOR;
  const e = Math.min(0.82, Math.max(0, eccentricity));
  const b = a * Math.sqrt(1 - e * e);
  const c = a * e;

  const orbitTube = useMemo(() => createOrbitTube(SEMI_MAJOR, b), [b]);
  // Equal-area eccentric anomaly spans: ΔM = Δu - e*(sin u1 - sin u0)
  const periHalf = 0.46;
  const targetM = 2 * (periHalf - e * Math.sin(periHalf));
  const apHalf = Math.min(0.95, targetM / (2 * (1 + e)));
  const periSector = useMemo(
    () => createSectorGeometry(SEMI_MAJOR, b, c, -periHalf, periHalf),
    [b, c]
  );
  const apSector = useMemo(
    () =>
      createSectorGeometry(
        SEMI_MAJOR,
        b,
        c,
        Math.PI - apHalf,
        Math.PI + apHalf
      ),
    [apHalf, b, c]
  );

  useEffect(
    () => () => {
      orbitTube.dispose();
      periSector.dispose();
      apSector.dispose();
    },
    [apSector, orbitTube, periSector]
  );

  const planetRadius = resolvePlanetRadius(body);

  useVisualStop(() => {
    anomalyRef.current = 0.68;
    if (planetRef.current !== null) {
      planetRef.current.position.set(
        a * Math.cos(0.68),
        0.24,
        b * Math.sin(0.68)
      );
      planetRef.current.rotation.y = 0;
    }
  });

  useFrame((_, delta) => {
    const planet = planetRef.current;
    if (planet === null) {
      return;
    }
    const rNorm = Math.max(0.22, 1 - e * Math.cos(anomalyRef.current));
    if (playing) {
      anomalyRef.current += (simulationStep(delta) * 1.15) / (rNorm * rNorm);
    }
    const px = a * Math.cos(anomalyRef.current);
    const pz = b * Math.sin(anomalyRef.current);
    planet.position.set(px, 0.24, pz);
    planet.rotation.y += playing ? delta * 0.8 : 0;
    if (tailRef.current !== null) {
      tailRef.current.rotation.y = Math.atan2(-pz, px - c);
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <KeplerCamera />

      {/* Deep-space starfield backdrop */}
      {Arr.map(STARS, (star) => (
        <mesh key={star.id} position={star.pos}>
          <sphereGeometry args={[star.size, 6, 6]} />
          <meshBasicMaterial color={QUANTUM_COLORS.starLight} />
        </mesh>
      ))}

      {/* Smooth elliptical orbital track */}
      <mesh geometry={orbitTube}>
        <meshStandardMaterial
          color={QUANTUM_COLORS.orbitTrack}
          emissive={QUANTUM_COLORS.orbitTrack}
          emissiveIntensity={0.35}
          roughness={0.35}
        />
      </mesh>

      {/* Equal-area swept sectors at perihelion (cyan) and aphelion (indigo) */}
      <mesh
        geometry={periSector}
        position={[0, 0.23, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial
          color={QUANTUM_COLORS.sectorFill}
          depthWrite={false}
          opacity={0.34}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh
        geometry={apSector}
        position={[0, 0.23, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshBasicMaterial
          color={QUANTUM_COLORS.sectorAphelion}
          depthWrite={false}
          opacity={0.34}
          side={DoubleSide}
          transparent
        />
      </mesh>

      {/* Multi-layer glowing Sun at right focus + radial point light */}
      <group position={[c, 0.24, 0]}>
        <pointLight
          color={QUANTUM_COLORS.sunCore}
          distance={6}
          intensity={3.5}
        />
        <mesh>
          <sphereGeometry args={[0.19, 32, 24]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.sunCore}
            emissive={QUANTUM_COLORS.sunCore}
            emissiveIntensity={1.6}
            roughness={0.2}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.26, 24, 18]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={QUANTUM_COLORS.sunCorona}
            depthWrite={false}
            opacity={0.28}
            transparent
          />
        </mesh>
      </group>

      {/* Empty left focus ring marker */}
      <mesh position={[-c, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.055, 0.009, 10, 28]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.aphelion}
          emissive={QUANTUM_COLORS.aphelion}
          emissiveIntensity={0.55}
        />
      </mesh>

      {/* Orbiting photorealistic planet (or comet with anti-solar ion & dust tails) */}
      <group
        position={[a * Math.cos(0.68), 0.24, b * Math.sin(0.68)]}
        ref={planetRef}
      >
        <PlanetMesh body={body} radius={planetRadius} />
        {body === "comet" ? (
          <group ref={tailRef}>
            <mesh position={[0.24, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.06, 0.45, 16, 1, true]} />
              <meshBasicMaterial
                blending={AdditiveBlending}
                color={QUANTUM_COLORS.cometIon}
                depthWrite={false}
                opacity={0.45}
                side={DoubleSide}
                transparent
              />
            </mesh>
            <mesh position={[0.18, 0, 0.04]} rotation={[0, 0.2, -Math.PI / 2]}>
              <coneGeometry args={[0.08, 0.34, 16, 1, true]} />
              <meshBasicMaterial
                blending={AdditiveBlending}
                color={QUANTUM_COLORS.cometDust}
                depthWrite={false}
                opacity={0.32}
                side={DoubleSide}
                transparent
              />
            </mesh>
          </group>
        ) : null}
      </group>

      {/* Crisp space labels cleanly spaced inside viewport with dark outline */}
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        outlineColor={QUANTUM_COLORS.furnaceSteel}
        outlineWidth={0.028}
        position={[c, 0.58, 0]}
      >
        <span>{parts.sun}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        outlineColor={QUANTUM_COLORS.furnaceSteel}
        outlineWidth={0.028}
        position={[-c, 0.48, -0.18]}
      >
        <span>{parts.focus}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        outlineColor={QUANTUM_COLORS.furnaceSteel}
        outlineWidth={0.028}
        position={[a - 0.08, 0.42, 0.34]}
      >
        <span>{parts.perihelion}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        outlineColor={QUANTUM_COLORS.furnaceSteel}
        outlineWidth={0.028}
        position={[-a + 0.08, 0.42, 0.34]}
      >
        <span>{parts.aphelion}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="compact"
        maximumFontSize={12}
        minimumFontSize={10}
        outlineColor={QUANTUM_COLORS.furnaceSteel}
        outlineWidth={0.028}
        position={[0.2, 0.36, b + 0.22]}
      >
        <span>
          {parts.planet} · {parts.areaSector}
        </span>
      </ThreeLabel>
    </group>
  );
}

useTexture.preload(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
