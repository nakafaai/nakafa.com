import { Effect, Predicate } from "effect";

const MOBILE_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/iu;

const MACINTOSH_REGEX = /Macintosh/iu;

/** Renderer names of the rasterizers that draw WebGL on the CPU. */
const SOFTWARE_RENDERER_REGEX =
  /SwiftShader|llvmpipe|softpipe|Software|Basic Render Driver/iu;

/** Maximum CPU core count or memory in GB considered a low-end device. */
const LOW_END_CORE_LIMIT = 4;
const LOW_END_MEMORY_LIMIT = 4;

/** Maximum concurrent WebGL contexts allowed per page by device class. */
export const MOBILE_WEBGL_CONTEXT_LIMIT = 2;
export const DESKTOP_WEBGL_CONTEXT_LIMIT = 4;

/** Reads Chromium's optional `navigator.deviceMemory` value in GB when finite and positive. */
function readDeviceMemory(): number | undefined {
  const memory: unknown = Reflect.get(navigator, "deviceMemory");
  return Predicate.isNumber(memory) && Number.isFinite(memory) && memory > 0
    ? memory
    : undefined;
}

/** Reads `navigator.hardwareConcurrency` when finite and positive. */
function readHardwareConcurrency(): number | undefined {
  const cores: unknown = navigator.hardwareConcurrency;
  return Predicate.isNumber(cores) && Number.isFinite(cores) && cores > 0
    ? cores
    : undefined;
}

/**
 * Checks if the current device is a mobile or tablet device, including iPadOS
 * Safari reporting a Macintosh user agent alongside multi-touch capability.
 *
 * @returns true if device is mobile or tablet, false otherwise
 */
export function isMobileDevice(): boolean {
  if (MOBILE_REGEX.test(navigator.userAgent)) {
    return true;
  }
  const touchPoints: unknown = navigator.maxTouchPoints;
  return (
    MACINTOSH_REGEX.test(navigator.userAgent) &&
    Predicate.isNumber(touchPoints) &&
    touchPoints > 1
  );
}

/**
 * Checks if the current device is hardware-constrained (4 or fewer CPU cores
 * or 4 GB or less reported device memory).
 *
 * @returns true if the device is low-end, false otherwise
 */
export function isLowEndDevice(): boolean {
  const cores = readHardwareConcurrency();
  if (cores !== undefined && cores <= LOW_END_CORE_LIMIT) {
    return true;
  }
  const memory = readDeviceMemory();
  return memory !== undefined && memory <= LOW_END_MEMORY_LIMIT;
}

/**
 * Determines the appropriate GPU power preference for the device.
 *
 * Mobile and low-memory devices use "default" to preserve battery and avoid
 * thermal throttling. Desktop devices with 4+ CPU cores and sufficient memory
 * use "high-performance".
 *
 * @returns "default" or "high-performance" power preference
 */
export function getPowerPreference(): "default" | "high-performance" {
  if (isMobileDevice()) {
    return "default";
  }

  const memory = readDeviceMemory();
  if (memory !== undefined && memory <= LOW_END_MEMORY_LIMIT) {
    return "default";
  }

  const cores = readHardwareConcurrency() ?? LOW_END_CORE_LIMIT;

  return cores >= LOW_END_CORE_LIMIT ? "high-performance" : "default";
}

/**
 * Chooses a stable device-pixel-ratio cap for WebGL canvases. Keeping the cap
 * bounded avoids framebuffer bloat while cutting fragment fill cost on phones
 * and low-end hardware.
 *
 * @returns `[1, 1.25]` on low-end devices, `[1, 1.5]` on mobile, and `[1, 2]` on desktop
 */
export function getCanvasDpr(): [number, number] {
  if (isLowEndDevice()) {
    return [1, 1.25];
  }
  return isMobileDevice() ? [1, 1.5] : [1, 2];
}

/**
 * Chooses whether to enable WebGL MSAA antialiasing. Disabling MSAA on low-end
 * devices and Retina mobile displays (DPR > 1) cuts framebuffer VRAM and
 * resolve bandwidth while high pixel density keeps edges crisp.
 *
 * @returns true when MSAA should be enabled, false otherwise
 */
export function shouldEnableAntialias(): boolean {
  if (isLowEndDevice()) {
    return false;
  }
  if (isMobileDevice()) {
    const dpr: unknown = Reflect.get(globalThis, "devicePixelRatio");
    return !(Predicate.isNumber(dpr) && dpr > 1);
  }
  return true;
}

/**
 * Maximum concurrent active WebGL contexts for the current device class.
 *
 * @returns 2 on mobile or low-end devices, 4 on capable desktops
 */
export function getMaxWebGLContexts(): number {
  return isMobileDevice() || isLowEndDevice()
    ? MOBILE_WEBGL_CONTEXT_LIMIT
    : DESKTOP_WEBGL_CONTEXT_LIMIT;
}

/**
 * Checks whether a WebGL renderer name belongs to a software rasterizer, which
 * draws on the CPU, so every full-screen pass costs a frame many times over.
 *
 * @param renderer - The renderer name WebGL reports
 * @returns true if the renderer draws on the CPU, false otherwise
 */
export function isSoftwareRenderer(renderer: string): boolean {
  return SOFTWARE_RENDERER_REGEX.test(renderer);
}

/**
 * Checks whether a WebGL rendering context supports half-float color buffers
 * needed for EXR environment PMREM generation and HDR postprocessing.
 */
export function supportsHalfFloatColorBuffer(
  context: { readonly getExtension: (name: string) => unknown },
  isWebGL2: boolean
): boolean {
  if (isWebGL2) {
    return (
      context.getExtension("EXT_color_buffer_half_float") !== null ||
      context.getExtension("EXT_color_buffer_float") !== null
    );
  }
  return (
    context.getExtension("OES_texture_half_float") !== null &&
    (context.getExtension("EXT_color_buffer_half_float") !== null ||
      context.getExtension("WEBGL_color_buffer_float") !== null)
  );
}

/**
 * Probes whether the browser currently allows creating a WebGL context,
 * immediately releasing the probe context so it never consumes a GPU slot.
 */
export function isWebGLAvailable(): boolean {
  if (typeof WebGLRenderingContext === "undefined") {
    return false;
  }
  return Effect.runSync(
    Effect.try({
      try: () => {
        const canvas = document.createElement("canvas");
        const context =
          canvas.getContext("webgl2", {
            failIfMajorPerformanceCaveat: false,
          }) ??
          canvas.getContext("webgl", {
            failIfMajorPerformanceCaveat: false,
          });
        if (!context) {
          return false;
        }
        context.getExtension("WEBGL_lose_context")?.loseContext();
        return true;
      },
      catch: () => false,
    }).pipe(Effect.orElseSucceed(() => false))
  );
}
