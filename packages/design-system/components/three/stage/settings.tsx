import { Environment, Sky, useEnvironment } from "@react-three/drei";
import { Backdrop } from "@repo/design-system/components/three/stage/backdrop";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { horizonColor } from "@repo/design-system/components/three/stage/horizon";
import { Motes } from "@repo/design-system/components/three/stage/motes";
import type { Place } from "@repo/design-system/components/three/stage/place";
import { toneColor } from "@repo/design-system/components/three/stage/place";
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

/** The light that falls into water, into a cell and up a microscope comes from nearly straight above. */
const DEEP_SUN = [0.246, 0.916, 0.317] as const;

/** Where the sun of each setting stands, which the key light and the glint on water share. */
export const SETTING_SUNS: Record<
  Place,
  readonly [x: number, y: number, z: number]
> = {
  cell: DEEP_SUN,
  dark: LAB_SUN,
  field: FIELD_SUN,
  lab: LAB_SUN,
  microscope: DEEP_SUN,
  sky: SKY_SUN,
  space: STUDIO_SUN,
  studio: STUDIO_SUN,
  water: DEEP_SUN,
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

/** Reads whether the page shows its dark theme, which dims a backdrop. */
export function useDark() {
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
 * The light of a photo studio's softboxes on the lab, without the studio
 * behind it, for a place that draws its own backdrop. Procedural fill light
 * takes over, without failing the lab, when the photo cannot load.
 *
 * @param ambient - The fill light from everywhere when the photo is missing
 * @param exposure - How brightly the softboxes light the lab
 * @param hemisphere - The fill light from above when the photo is missing
 */
export function Softboxes({
  ambient,
  exposure,
  hemisphere,
}: {
  readonly ambient: number;
  readonly exposure: number;
  readonly hemisphere: number;
}) {
  const { profile } = useStage();

  if (!profile.useExrEnvironment) {
    return <ProceduralFillFallback ambient={ambient} hemisphere={hemisphere} />;
  }

  return (
    <ErrorBoundary
      fallbackRender={() => (
        <ProceduralFillFallback ambient={ambient} hemisphere={hemisphere} />
      )}
      report={false}
    >
      <Environment
        environmentIntensity={exposure}
        environmentRotation={[0, STUDIO_TURN, 0]}
        files={`/environments/${profile.environmentDirectory}/studio.exr`}
      />
    </ErrorBoundary>
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
export function Sun({
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
  const dark = useDark();
  const backdrop = dark ? getColor("NEUTRAL", 700) : getColor("ZINC", 100);

  return (
    <>
      <color args={[backdrop]} attach="background" />
      <Softboxes ambient={0.4} exposure={1} hemisphere={0.9} />
      <Sun direction={STUDIO_SUN} intensity={1.4} />
      <Haze color={backdrop} />
    </>
  );
}

/** The tone of open space between the stars, the same in both themes. */
const VOID = toneColor([4, 5, 10]);

/**
 * Open space: one hard sun, standing in the sky as a disc with its glare,
 * and the faint fill of distant light, against stars at every depth of
 * brightness and the pale band of dust they gather in. It stays dark in both
 * themes, and procedural fill light takes over without failing the lab.
 */
export function SpaceSetting() {
  return (
    <>
      <color args={[VOID]} attach="background" />
      <Backdrop
        band={0.05}
        body={VOID}
        disc={1}
        glow={toneColor([174, 188, 255])}
        high={toneColor([5, 6, 13])}
        low={VOID}
      />
      <Motes
        distant
        from={toneColor([255, 210, 168])}
        lit
        opacity={1}
        pace={0.6}
        seed={61}
        size={2.6}
        to={toneColor([188, 208, 255])}
      />
      <Softboxes ambient={0.22} exposure={0.15} hemisphere={0} />
      <Sun direction={STUDIO_SUN} intensity={3.2} />
    </>
  );
}

/**
 * A teaching laboratory with its lights off, for beams, glowing tubes and
 * screens: the same room, benches and windows, a small part as bright, with
 * one dim lamp overhead as its key light and dust in the air, so a beam
 * shows along its whole length. It stays dark in both themes.
 */
export function DarkSetting() {
  const { profile } = useStage();

  return (
    <>
      {profile.useExrEnvironment ? (
        <ErrorBoundary fallbackRender={() => <Unlit />} report={false}>
          <PhotoEnvironment
            backdrop={0.11}
            blur={0.2}
            exposure={0.36}
            file="lab"
            turn={LAB_TURN}
          />
        </ErrorBoundary>
      ) : (
        <Unlit />
      )}
      <Sun direction={LAB_SUN} intensity={1.1} />
      <Motes
        blur={1.4}
        drift={0.02}
        from={toneColor([143, 163, 196])}
        hollow={0.2}
        lit
        opacity={0.1}
        pace={0.25}
        seed={71}
        share={0.5}
        size={0.016}
        spread={3}
        to={toneColor([214, 223, 240])}
      />
    </>
  );
}

/** The dark of an unlit room and the little light left in it, when its photo cannot load. */
function Unlit() {
  const backdrop = getColor("ZINC", 950);

  return (
    <>
      <color args={[backdrop]} attach="background" />
      <ProceduralFillFallback ambient={0.08} hemisphere={0.14} />
      <Haze color={backdrop} />
    </>
  );
}
