const MOBILE_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/iu;

/** Renderer names of the rasterizers that draw WebGL on the CPU. */
const SOFTWARE_RENDERER_REGEX =
  /SwiftShader|llvmpipe|softpipe|Software|Basic Render Driver/iu;

/**
 * Checks if the current device is a mobile device based on user agent
 *
 * @returns true if device is mobile, false otherwise
 */
export function isMobileDevice(): boolean {
  return MOBILE_REGEX.test(navigator.userAgent);
}

/**
 * Determines the appropriate GPU power preference for the device
 *
 * Mobile devices always use "default" to preserve battery.
 * Desktop devices with 4+ CPU cores use "high-performance" for better
 * rendering quality, others use "default".
 *
 * @returns "default" or "high-performance" power preference
 */
export function getPowerPreference(): "default" | "high-performance" {
  if (isMobileDevice()) {
    return "default";
  }

  const cores = navigator.hardwareConcurrency ?? 4;

  return cores >= 4 ? "high-performance" : "default";
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
