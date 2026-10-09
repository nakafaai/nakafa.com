import { Result } from "effect";

const MOBILE_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

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

/** The browser's answer to the WebGL2 probe, remembered after the first question. */
let hardwareWebGLAnswer: boolean | undefined;

/**
 * Asks the browser once whether it can draw WebGL2 on a GPU.
 *
 * `failIfMajorPerformanceCaveat` makes the browser refuse a context it would
 * run in software, so a machine without a usable GPU answers no. The probe
 * context is released at once, and later calls return the same answer.
 *
 * @returns true if the browser gives a hardware-accelerated WebGL2 context
 */
export function hasHardwareWebGL(): boolean {
  hardwareWebGLAnswer ??= probeHardwareWebGL();

  return hardwareWebGLAnswer;
}

/** Creates one probe context, releases it, and reports whether it came back. */
function probeHardwareWebGL(): boolean {
  const context = Result.getOrNull(
    Result.try(() =>
      document
        .createElement("canvas")
        .getContext("webgl2", { failIfMajorPerformanceCaveat: true })
    )
  );

  if (context === null) {
    return false;
  }

  context.getExtension("WEBGL_lose_context")?.loseContext();

  return true;
}
