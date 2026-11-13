import { Environment, Lightformer, Sky } from "@react-three/drei";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { Suspense } from "react";

/**
 * Each setting turns its photo so the photo's brightest light falls where the
 * stage's key light stands, at an azimuth of 52 degrees from +x toward +z, and
 * gives the key light the sun's elevation. Measured from each 1k HDRI as the
 * luminance-weighted direction of its brightest 0.2% of pixels: the lab's
 * windows at -28.1 degrees and 41.3 up, the meadow's sun at 36.2 and 27 up,
 * and the studio's largest softbox at 54.6 and 19 up.
 */
const LAB_TURN = -1.398;
const FIELD_TURN = -0.276;
const STUDIO_TURN = 0.045;

/** Unit directions toward each setting's sun, at the key light's azimuth. */
const LAB_SUN = [0.463, 0.66, 0.592] as const;
const FIELD_SUN = [0.549, 0.454, 0.702] as const;
const SKY_SUN = [0.505, 0.574, 0.645] as const;
const STUDIO_SUN = [0.423, 0.725, 0.544] as const;

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

/**
 * The light of a photo studio, built from glowing panels around an empty
 * scene and baked once into the environment map. Nothing is downloaded, so it
 * lights a lab at once while the setting's own file loads: a wide box
 * overhead, two long strips that draw highlights along glass and metal, a
 * front panel that opens the shadows, and a dim floor bounce.
 */
function Panels() {
  return (
    <Environment environmentIntensity={0.85} frames={1} resolution={256}>
      <Lightformer
        form="rect"
        intensity={2.2}
        position={[0, 7, 0]}
        rotation-x={Math.PI / 2}
        scale={[14, 14, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.4}
        position={[-7, 2.5, 0]}
        rotation-y={Math.PI / 2}
        scale={[18, 1.4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.4}
        position={[7, 2.5, 0]}
        rotation-y={-Math.PI / 2}
        scale={[18, 1.4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.9}
        position={[0, 2.5, 9]}
        scale={[12, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.3}
        position={[0, -5, 0]}
        rotation-x={-Math.PI / 2}
        scale={[24, 24, 1]}
      />
    </Environment>
  );
}

/**
 * A photographed place that both lights the lab and stands behind it, blurred
 * as a lens focused on the lab would blur it. The backdrop is exposed apart
 * from the light, as a photographer exposes for the subject, and dims in the
 * dark theme. A phone loads the half-size file, which it decodes in a quarter
 * of the time.
 */
function Photo({
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
  const { phone } = useStage();
  const dark = useDark();

  return (
    <Suspense fallback={<Panels />}>
      <Environment
        background
        backgroundBlurriness={blur}
        backgroundIntensity={dark ? backdrop * DARK_BACKDROP : backdrop}
        backgroundRotation={[0, turn, 0]}
        environmentIntensity={exposure}
        environmentRotation={[0, turn, 0]}
        files={`/environments/${phone ? "phone" : "desktop"}/${file}.exr`}
      />
    </Suspense>
  );
}

/**
 * The key light, standing where the setting's sun stands. It casts the lab's
 * shadows over the lab's reach: softer and sharper on a desktop, half the map
 * on a phone.
 */
function Sun({
  color,
  direction,
  intensity,
}: {
  readonly color: string;
  readonly direction: readonly [number, number, number];
  readonly intensity: number;
}) {
  const { phone, reach } = useStage();
  const [x, y, z] = direction;
  const distance = SUN_DISTANCE * reach;
  const mapSize = phone ? 1024 : 2048;

  return (
    <directionalLight
      castShadow
      color={color}
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
      shadow-radius={phone ? 2 : 4}
    />
  );
}

/** Fades distant ground into the tone of the backdrop's horizon. */
function Haze({ color }: { readonly color: string }) {
  const { reach } = useStage();

  return <fog args={[color, FOG_NEAR * reach, FOG_FAR * reach]} attach="fog" />;
}

/** A teaching laboratory with benches and tall windows. */
export function LabSetting() {
  const dark = useDark();

  return (
    <>
      <Photo
        backdrop={3}
        blur={0.18}
        exposure={1.5}
        file="lab"
        turn={LAB_TURN}
      />
      <Sun color="#ffffff" direction={LAB_SUN} intensity={1.5} />
      <Haze color={dark ? "#606853" : "#949f80"} />
    </>
  );
}

/** An open meadow in afternoon sun, for anything that moves outdoors. */
export function FieldSetting() {
  const dark = useDark();

  return (
    <>
      <Photo
        backdrop={2.2}
        blur={0.2}
        exposure={1.8}
        file="field"
        turn={FIELD_TURN}
      />
      <Sun color="#fff1df" direction={FIELD_SUN} intensity={2.6} />
      <Haze color={dark ? "#596351" : "#89977d"} />
    </>
  );
}

/**
 * Open sky over the sea, for flight and launches. The sky is drawn rather
 * than photographed, so its sun stands exactly where the key light stands. A
 * drawn sky is far brighter than a photo, so it lights and backs the lab at a
 * fifth of its strength.
 */
export function SkySetting() {
  const dark = useDark();

  return (
    <>
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
      <Sun color="#fff4e6" direction={SKY_SUN} intensity={2.4} />
    </>
  );
}

/**
 * A photo studio's seamless backdrop near the card's own tone, lit by the
 * studio's softboxes, for apparatus, particles, and specimens shown on their
 * own. The finish's tone mapping takes the four percent a lit surface
 * reflects off every color, which leaves an unlit dark backdrop black, so the
 * dark theme paints the backdrop one shade lighter than the tone it shows.
 */
export function StudioSetting() {
  const { phone } = useStage();
  const dark = useDark();
  const backdrop = dark ? getColor("NEUTRAL", 700) : getColor("NEUTRAL", 100);

  return (
    <>
      <color args={[backdrop]} attach="background" />
      <Suspense fallback={<Panels />}>
        <Environment
          environmentIntensity={1}
          environmentRotation={[0, STUDIO_TURN, 0]}
          files={`/environments/${phone ? "phone" : "desktop"}/studio.exr`}
        />
      </Suspense>
      <Sun color="#ffffff" direction={STUDIO_SUN} intensity={1.4} />
      <Haze color={backdrop} />
    </>
  );
}

/**
 * Open space: one hard sun and the faint fill of distant light against a
 * backdrop that stays dark in both themes, as space does.
 */
export function SpaceSetting() {
  const { phone } = useStage();

  return (
    <>
      <color args={[getColor("ZINC", 950)]} attach="background" />
      <Suspense fallback={null}>
        <Environment
          environmentIntensity={0.15}
          files={`/environments/${phone ? "phone" : "desktop"}/studio.exr`}
        />
      </Suspense>
      <Sun color="#ffffff" direction={STUDIO_SUN} intensity={3.2} />
    </>
  );
}
