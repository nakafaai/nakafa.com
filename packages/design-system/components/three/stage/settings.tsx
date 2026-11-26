import { Environment, Sky, useEnvironment } from "@react-three/drei";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { horizonColor } from "@repo/design-system/components/three/stage/horizon";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { useMemo } from "react";
import type { ColorRepresentation } from "three";
import { DataTexture } from "three";

/**
 * Each setting turns its photo so the photo's brightest light falls where the
 * stage's key light stands, at an azimuth of 52 degrees from +x toward +z, and
 * gives the key light the sun's elevation.
 */
const LAB_TURN = -1.398;
const FIELD_TURN = -0.2775;
const STUDIO_TURN = 0.045;

/** Unit directions toward each setting's sun, at the key light's azimuth. */
const LAB_SUN = [0.463, 0.66, 0.592] as const;
const FIELD_SUN = [0.533, 0.5, 0.682] as const;
const SKY_SUN = [0.505, 0.574, 0.645] as const;
const STUDIO_SUN = [0.423, 0.725, 0.544] as const;

/** Where the sun of each setting stands, which the key light and the glint on water share. */
export const SETTING_SUNS = {
  field: FIELD_SUN,
  lab: LAB_SUN,
  sky: SKY_SUN,
  space: STUDIO_SUN,
  studio: STUDIO_SUN,
};

/** How far the key light stands from the lab's middle, in reaches. */
const SUN_DISTANCE = 1.66;

/**
 * How much a photo backdrop keeps in the dark theme, so the card does not
 * glare out of a dark page while the light on the lab stays.
 */
const DARK_BACKDROP = 0.4;

/** Where distant ground starts and finishes fading into the backdrop, in reaches. */
const FOG_NEAR = 3;
const FOG_FAR = 12;

/** Reads whether the page shows its dark theme, which dims a photo backdrop. */
function useDark() {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  return getThemeAppearance(resolvedTheme) === "dark";
}

function resolveFallbackBackdrop(file: "field" | "lab" | "sky", dark: boolean) {
  if (file === "lab") {
    return dark ? getColor("NEUTRAL", 800) : getColor("ZINC", 100);
  }
  return dark ? getColor("SLATE", 800) : getColor("SLATE", 50);
}

/**
 * Procedural backdrop and fill lighting used when EXR HDRI loading fails or
 * when the device's WebGL context lacks half-float buffer support.
 */
function ProceduralPhotoFallback({
  file,
}: {
  readonly file: "field" | "lab" | "sky";
}) {
  const dark = useDark();
  const backdrop = resolveFallbackBackdrop(file, dark);
  const skyLight = file === "lab" ? getColor("WHITE") : getColor("SLATE", 200);
  const groundLight =
    file === "lab" ? getColor("NEUTRAL", 300) : getColor("STONE", 600);

  return (
    <>
      <color args={[backdrop]} attach="background" />
      <hemisphereLight args={[skyLight, groundLight, dark ? 0.85 : 1.15]} />
      <ambientLight intensity={dark ? 0.3 : 0.45} />
      <Haze color={backdrop} />
    </>
  );
}

/** Procedural fill lighting for studio and space settings when EXR is unavailable. */
function ProceduralFillFallback({
  ambient,
  hemisphere,
}: {
  readonly ambient: number;
  readonly hemisphere: number;
}) {
  return (
    <>
      <ambientLight intensity={ambient} />
      {hemisphere > 0 ? (
        <hemisphereLight
          args={[getColor("WHITE"), getColor("NEUTRAL", 700), hemisphere]}
        />
      ) : null}
    </>
  );
}

/**
 * A photographed place that both lights the lab and stands behind it, blurred
 * as a lens focused on the lab would blur it. A phone loads the half-size file,
 * which decodes in a quarter of the time.
 */
function PhotoEnvironment({
  backdrop,
  blur,
  exposure,
  file,
  turn,
}: {
  readonly backdrop: number;
  readonly blur: number;
  readonly exposure: number;
  readonly file: "field" | "lab";
  readonly turn: number;
}) {
  const { profile } = useStage();
  const dark = useDark();
  const texture = useEnvironment({
    files: `/environments/${profile.environmentDirectory}/${file}.exr`,
  });
  const shown = dark ? backdrop * DARK_BACKDROP : backdrop;
  const haze = useMemo(
    () =>
      texture instanceof DataTexture &&
      texture.image.data instanceof Uint16Array
        ? horizonColor(
            texture.image.data,
            texture.image.width,
            texture.image.height,
            shown
          )
        : undefined,
    [shown, texture]
  );

  return (
    <>
      <Environment
        background
        backgroundBlurriness={blur}
        backgroundIntensity={shown}
        backgroundRotation={[0, turn, 0]}
        environmentIntensity={exposure}
        environmentRotation={[0, turn, 0]}
        map={texture}
      />
      {haze === undefined ? null : <Haze color={haze} />}
    </>
  );
}

/** Wraps photographed EXR lighting in a non-fatal procedural fallback boundary. */
function Photo(props: {
  readonly backdrop: number;
  readonly blur: number;
  readonly exposure: number;
  readonly file: "field" | "lab";
  readonly turn: number;
}) {
  const { profile } = useStage();

  if (!profile.useExrEnvironment) {
    return <ProceduralPhotoFallback file={props.file} />;
  }

  return (
    <ErrorBoundary
      fallbackRender={() => <ProceduralPhotoFallback file={props.file} />}
      report={false}
    >
      <PhotoEnvironment {...props} />
    </ErrorBoundary>
  );
}

/**
 * The key light, standing where the setting's sun stands. Shadow map size and
 * softness scale with the device's stage profile (512 low-end, 1024 mobile,
 * 2048 desktop).
 */
function Sun({
  direction,
  intensity,
}: {
  readonly direction: readonly [number, number, number];
  readonly intensity: number;
}) {
  const { profile, reach } = useStage();
  const [x, y, z] = direction;
  const distance = SUN_DISTANCE * reach;
  const mapSize = profile.shadowMapSize;

  return (
    <directionalLight
      castShadow
      intensity={intensity}
      position={[x * distance, y * distance, z * distance]}
      shadow-bias={-0.0006}
      shadow-camera-bottom={-reach}
      shadow-camera-left={-reach}
      shadow-camera-right={reach}
      shadow-camera-top={reach}
      shadow-mapSize-height={mapSize}
      shadow-mapSize-width={mapSize}
      shadow-normalBias={0.02}
      shadow-radius={profile.shadowRadius}
    />
  );
}

/** Fades distant ground into the tone of the backdrop's horizon. */
function Haze({ color }: { readonly color: ColorRepresentation }) {
  const { reach } = useStage();

  return <fog args={[color, FOG_NEAR * reach, FOG_FAR * reach]} attach="fog" />;
}

/** A teaching laboratory with benches and tall windows. */
export function LabSetting() {
  return (
    <>
      <Photo
        backdrop={3}
        blur={0.18}
        exposure={1.5}
        file="lab"
        turn={LAB_TURN}
      />
      <Sun direction={LAB_SUN} intensity={1.5} />
    </>
  );
}

/** An open park field under a clear sky with a distant tree line, for anything that moves outdoors. */
export function FieldSetting() {
  return (
    <>
      <Photo
        backdrop={4}
        blur={0.12}
        exposure={3.5}
        file="field"
        turn={FIELD_TURN}
      />
      <Sun direction={FIELD_SUN} intensity={2.6} />
    </>
  );
}

/**
 * Open sky over the sea, for flight and launches. Wrapped in a non-fatal
 * boundary so procedural lighting takes over if environment cubemap generation
 * fails on constrained hardware.
 */
export function SkySetting() {
  const { profile } = useStage();
  const dark = useDark();

  return (
    <>
      {profile.useExrEnvironment ? (
        <ErrorBoundary
          fallbackRender={() => <ProceduralPhotoFallback file="sky" />}
          report={false}
        >
          <Environment
            background
            backgroundIntensity={dark ? 0.2 * DARK_BACKDROP : 0.2}
            environmentIntensity={0.2}
            frames={1}
            resolution={256}
          >
            <Sky
              distance={450}
              mieCoefficient={0.006}
              mieDirectionalG={0.72}
              rayleigh={1.2}
              sunPosition={SKY_SUN}
              turbidity={4.2}
            />
          </Environment>
        </ErrorBoundary>
      ) : (
        <ProceduralPhotoFallback file="sky" />
      )}
      <Sun direction={SKY_SUN} intensity={2.4} />
      <Haze color={dark ? getColor("SLATE", 700) : getColor("SLATE", 200)} />
    </>
  );
}

/**
 * A photo studio's seamless backdrop near the card's own tone, lit by the
 * studio's softboxes, with non-fatal fallback to procedural studio fill light.
 */
export function StudioSetting() {
  const { profile } = useStage();
  const dark = useDark();
  const backdrop = dark ? getColor("NEUTRAL", 700) : getColor("ZINC", 100);

  return (
    <>
      <color args={[backdrop]} attach="background" />
      {profile.useExrEnvironment ? (
        <ErrorBoundary
          fallbackRender={() => (
            <ProceduralFillFallback ambient={0.4} hemisphere={0.9} />
          )}
          report={false}
        >
          <Environment
            environmentIntensity={1}
            environmentRotation={[0, STUDIO_TURN, 0]}
            files={`/environments/${profile.environmentDirectory}/studio.exr`}
          />
        </ErrorBoundary>
      ) : (
        <ProceduralFillFallback ambient={0.4} hemisphere={0.9} />
      )}
      <Sun direction={STUDIO_SUN} intensity={1.4} />
      <Haze color={backdrop} />
    </>
  );
}

/**
 * Open space: one hard sun and the faint fill of distant light against a
 * backdrop that stays dark in both themes, with non-fatal procedural fallback.
 */
export function SpaceSetting() {
  const { profile } = useStage();

  return (
    <>
      <color args={[getColor("ZINC", 950)]} attach="background" />
      {profile.useExrEnvironment ? (
        <ErrorBoundary
          fallbackRender={() => (
            <ProceduralFillFallback ambient={0.22} hemisphere={0} />
          )}
          report={false}
        >
          <Environment
            environmentIntensity={0.15}
            files={`/environments/${profile.environmentDirectory}/studio.exr`}
          />
        </ErrorBoundary>
      ) : (
        <ProceduralFillFallback ambient={0.22} hemisphere={0} />
      )}
      <Sun direction={STUDIO_SUN} intensity={3.2} />
    </>
  );
}
