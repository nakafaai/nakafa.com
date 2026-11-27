import { useGLTF } from "@react-three/drei";
import { TERRA_SATELLITE_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { boxWrap } from "@repo/design-system/components/contents/biology/climate/wrap";
import type { BiologyLabProps } from "@repo/design-system/components/contents/biology/lab";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab";
import { RotatingGroup } from "@repo/design-system/components/contents/biology/motion";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import {
  Air,
  Planet,
} from "@repo/design-system/components/three/habitat/planet";
import { Stars } from "@repo/design-system/components/three/habitat/sky";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { solarTexture } from "@repo/design-system/components/three/surface/solar";
import type { NarrowCameraPose } from "@repo/design-system/lib/geometry/camera";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { Array as Arr, Record as Rec } from "effect";
import { useEffect, useMemo } from "react";
import type { Group, Material, Texture } from "three";
import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Euler,
  Mesh,
  MeshPhysicalMaterial,
  RepeatWrapping,
  Vector3,
} from "three";

const CLIMATE_OBSERVATION_VIEW = {
  cameraPosition: [2.55, 1.58, 3.48],
  cameraTarget: [0.02, 0.12, 0.02],
  narrowCameraPosition: [2.55, 1.58, 3.48],
} satisfies NarrowCameraPose;

/** The Earth's radius in the scene. */
const EARTH = 1.14;

/**
 * How fast the air thins with height and how far its haze reaches, both a
 * little deeper than the real atmosphere so the limb reads at this size.
 */
const AIR = { depth: 0.014, reach: EARTH * 1.14 } as const;

/** How far away the stars stand. */
const STAR_DISTANCE = 40;

/** Where the satellite flies and how it is turned, beside the turning Earth. */
const ORBIT = {
  place: new Vector3(1.152, 1.416, 0.696),
  turn: new Euler(0.12, -0.58, 0.08),
} as const;

/** The direction from the Earth's middle up to the satellite. */
const ZENITH = ORBIT.place.clone().normalize();

/** The axis the instrument's mirror swings about: the way the satellite flies. */
const HEADING = new Vector3()
  .crossVectors(ZENITH, new Vector3(0, 1, 0))
  .cross(ZENITH)
  .normalize();

/** How far to each side of the point below the satellite the instrument scans, in radians. */
const HALF_SWATH = 0.2;

/**
 * Where the instrument looks out: the side of the satellite's body that
 * faces the Earth. The body sits at one end of the model, its solar array
 * reaching out to the other.
 */
const INSTRUMENT = new Vector3(0, 0, -0.4)
  .applyEuler(ORBIT.turn)
  .add(ORBIT.place)
  .addScaledVector(ZENITH, -0.1);

/** How many steps the ground track is drawn in. */
const TRACK_STEPS = 24;

/** How many tiles of each surface cross one scene unit of the satellite. */
const TILES = { foil: 9, metal: 6, panel: 14 } as const;

export function ClimateObservationLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={ClimateObservationScene}
      setting="space"
      view={CLIMATE_OBSERVATION_VIEW}
      {...props}
    />
  );
}

/**
 * The scene: the Earth turning under its weather against the stars, and the
 * Terra satellite above it with the strip of ground its instrument scans.
 */
function ClimateObservationScene() {
  const { sun } = useStage();

  return (
    <group position={[0, -0.04, 0]}>
      <CameraBounds exclude>
        <Stars backdrop radius={STAR_DISTANCE} />
        <Air
          depth={AIR.depth}
          radius={EARTH}
          reach={AIR.reach}
          strength={0.9}
          sun={sun}
        />
      </CameraBounds>
      <group rotation={[-0.08, -0.3, 0.02]}>
        <RotatingGroup speed={0.012}>
          <Globe />
        </RotatingGroup>
        <SensorSwath />
        <group position={ORBIT.place} rotation={ORBIT.turn}>
          <TerraSatelliteModel />
        </group>
      </group>
    </group>
  );
}

/** The Earth, lit from where the stage's sun stands. */
function Globe() {
  const { sun } = useStage();

  return (
    <group rotation={[0.08, -1.35, 0]}>
      <Planet body="earth" radius={EARTH} sun={sun} />
    </group>
  );
}

/** A point of the ground track across the swath, lifted just off the clouds. */
function trackPoint(share: number) {
  return ZENITH.clone()
    .applyAxisAngle(HEADING, (share - 0.5) * 2 * HALF_SWATH)
    .multiplyScalar(EARTH * 1.014);
}

/** How bright the fan of view is at the instrument and halfway down; it has faded out where it meets the ground. */
const FAN = { middle: 0.07, top: 0.34 } as const;

/** Half the width of the scanned band on the ground, along the way the satellite flies, in scene units. */
const BAND_HALF = 0.02;

/** How bright the middle of the scanned band is. */
const BAND_GLOW = 0.5;

/** A geometry of coloured corners joined into triangles. */
function shaded(
  places: readonly number[],
  tones: readonly number[],
  corners: readonly number[]
) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(Float32Array.from(places), 3)
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(Float32Array.from(tones), 3)
  );
  geometry.setIndex([...corners]);
  return geometry;
}

/** The corners of the triangles that join two rows of points, each `TRACK_STEPS + 1` long, starting at `upper` and `lower`. */
function ladder(upper: number, lower: number) {
  return Arr.flatMap(Arr.range(0, TRACK_STEPS - 1), (step) => [
    upper + step,
    lower + step,
    lower + step + 1,
    upper + step,
    lower + step + 1,
    upper + step + 1,
  ]);
}

/**
 * The fan of view from the instrument down to the ground track: bright at
 * the instrument, faint halfway down, and faded out before it reaches the
 * ground, so it lays nothing over the planet's face.
 */
function fanGeometry(track: readonly Vector3[]) {
  const halfway = Arr.map(track, (point) =>
    point.clone().lerp(INSTRUMENT, 0.5)
  );
  return shaded(
    [
      ...INSTRUMENT.toArray(),
      ...Arr.flatMap(halfway, (point) => point.toArray()),
      ...Arr.flatMap(track, (point) => point.toArray()),
    ],
    [
      FAN.top,
      FAN.top,
      FAN.top,
      ...Arr.flatMap(halfway, () => [FAN.middle, FAN.middle, FAN.middle]),
      ...Arr.flatMap(track, () => [0, 0, 0]),
    ],
    [
      ...Arr.flatMap(Arr.range(1, TRACK_STEPS), (step) => [0, step, step + 1]),
      ...ladder(1, TRACK_STEPS + 2),
    ]
  );
}

/**
 * The band of ground the instrument is scanning: a soft strip of light
 * lying on the planet across the satellite's path, brightest along its
 * middle and fading to nothing at its edges and its two ends.
 */
function bandGeometry(track: readonly Vector3[]) {
  const height = EARTH * 1.014;
  const edge = (side: number) =>
    Arr.flatMap(track, (point) =>
      point
        .clone()
        .addScaledVector(HEADING, side * BAND_HALF)
        .setLength(height)
        .toArray()
    );
  const dark = Arr.flatMap(track, () => [0, 0, 0]);
  return shaded(
    [
      ...edge(1),
      ...Arr.flatMap(track, (point) => point.toArray()),
      ...edge(-1),
    ],
    [
      ...dark,
      ...Arr.flatMap(track, (_, step) => {
        const glow =
          BAND_GLOW * Math.min(1, step / 3, (TRACK_STEPS - step) / 3);
        return [glow, glow, glow];
      }),
      ...dark,
    ],
    [
      ...ladder(0, TRACK_STEPS + 1),
      ...ladder(TRACK_STEPS + 1, 2 * TRACK_STEPS + 2),
    ]
  );
}

/** Light added over what lies behind it, in the instrument's colour, by how bright each corner is. */
function Beam() {
  return (
    <meshBasicMaterial
      blending={AdditiveBlending}
      color={ECOLOGY_COLORS.sensorSwath}
      depthWrite={false}
      side={DoubleSide}
      toneMapped={false}
      transparent
      vertexColors
    />
  );
}

/**
 * The strip of ground the satellite's instrument sees: a faint fan of view
 * leaving the instrument, and the soft band it scans on the ground.
 */
function SensorSwath() {
  const { band, fan } = useMemo(() => {
    const track = Arr.makeBy(TRACK_STEPS + 1, (step) =>
      trackPoint(step / TRACK_STEPS)
    );
    return { band: bandGeometry(track), fan: fanGeometry(track) };
  }, []);
  useEffect(
    () => () => {
      band.dispose();
      fan.dispose();
    },
    [band, fan]
  );

  return (
    <group>
      <mesh geometry={fan}>
        <Beam />
      </mesh>
      <mesh geometry={band}>
        <Beam />
      </mesh>
    </group>
  );
}

/** The Terra satellite in the materials it flies in. */
function TerraSatelliteModel() {
  const { scene } = useGLTF(TERRA_SATELLITE_ASSET.path);
  const { materials, satellite, textures } = useMemo(
    () => prepareSatellite(scene),
    [scene]
  );
  useEffect(
    () => () => {
      for (const material of materials) {
        material.dispose();
      }
      for (const texture of textures) {
        texture.dispose();
      }
    },
    [materials, textures]
  );

  return <primitive object={satellite} />;
}

/** A shared painted image laid as a repeating tile, as a copy this lab frees. */
function tiled(texture: Texture) {
  const copy = texture.clone();
  copy.wrapS = RepeatWrapping;
  copy.wrapT = RepeatWrapping;
  copy.needsUpdate = true;
  return copy;
}

/**
 * The finishes of the satellite: crinkled gold Kapton blankets, glassy solar
 * cells with their busbars, and brushed aluminium for trusses and dish.
 */
function satelliteFinishes() {
  const crinkle = tiled(surfaceMaps("cast").normal);
  const brushedNormal = tiled(surfaceMaps("brushed").normal);
  const brushedFinish = tiled(surfaceMaps("brushed").finish);
  const cells = tiled(solarTexture(4, 4));
  const metal = (color: string) =>
    new MeshPhysicalMaterial({
      color,
      metalness: 0.9,
      normalMap: brushedNormal,
      roughness: 0.42,
      roughnessMap: brushedFinish,
    });
  const foil = new MeshPhysicalMaterial({
    color: ECOLOGY_COLORS.satelliteFoil,
    envMapIntensity: 1.7,
    metalness: 1,
    normalMap: crinkle,
    roughness: 0.26,
  });
  foil.normalScale.setScalar(1.3);
  return {
    finishes: {
      dish: new MeshPhysicalMaterial({
        color: ECOLOGY_COLORS.satelliteDish,
        normalMap: brushedNormal,
        roughness: 0.55,
      }),
      foil,
      metal: metal(ECOLOGY_COLORS.satelliteMetal),
      nozzle: metal(ECOLOGY_COLORS.satelliteNozzle),
      panel: new MeshPhysicalMaterial({
        clearcoat: 0.5,
        clearcoatRoughness: 0.12,
        envMapIntensity: 0.45,
        map: cells,
        metalness: 0.1,
        roughness: 0.34,
      }),
    },
    textures: [crinkle, brushedNormal, brushedFinish, cells],
  };
}

/** Which finish a part of the model wears, by the name of its material. */
function finishOf(material: Material | Material[]) {
  const name = (Arr.isArray(material) ? material[0] : material)?.name ?? "";
  if (name.includes("Solar") || name.includes("Side Panels")) {
    return "panel";
  }
  if (name.includes("Gold")) {
    return "foil";
  }
  if (name.includes("Thruster")) {
    return "nozzle";
  }
  return name.includes("Dish") ? "dish" : "metal";
}

/** How many tiles of a finish cross one scene unit. */
function tilesOf(finish: ReturnType<typeof finishOf>) {
  if (finish === "panel") {
    return TILES.panel;
  }
  return finish === "foil" ? TILES.foil : TILES.metal;
}

/**
 * A copy of the model fitted to the scene and centred, each part wrapped so
 * its finish tiles at true size and dressed in that finish.
 */
function prepareSatellite(source: Group) {
  const satellite = source.clone(true);
  const bounds = new Box3().setFromObject(satellite);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const scale = 1.14 / Math.max(size.x, size.y, size.z);
  const { finishes, textures } = satelliteFinishes();

  satellite.scale.setScalar(scale);
  satellite.position.set(
    -center.x * scale,
    -center.y * scale,
    -center.z * scale
  );
  satellite.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    const finish = finishOf(child.material);
    const geometry: BufferGeometry = child.geometry;
    geometry.computeVertexNormals();
    geometry.setAttribute(
      "uv",
      new BufferAttribute(
        boxWrap(
          geometry.getAttribute("position").array,
          geometry.getAttribute("normal").array,
          scale * tilesOf(finish)
        ),
        2
      )
    );
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = finishes[finish];
  });

  return { materials: Rec.values(finishes), satellite, textures };
}

useGLTF.preload(TERRA_SATELLITE_ASSET.path);
