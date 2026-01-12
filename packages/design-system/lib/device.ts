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
 * Checks if WebGL2 is supported in the current browser
 *
 * Attempts to create a canvas and get a WebGL2 context. Returns false if
 * window or document is undefined, or if context creation fails.
 *
 * @returns true if WebGL2 is supported, false otherwise
 */
export function checkWebGL2Support(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");

    return context !== null;
  } catch {
    return false;
  }
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
 * Collects device information for analytics tracking
 *
 * Gathers mobile detection, CPU core count, GPU power preference,
 * and user agent string for device capability analysis.
 *
 * @returns Object containing device analytics data
 */
export function getDeviceInfoForAnalytics(): {
  isMobile: boolean;
  cores: number;
  powerPreference: "default" | "high-performance";
  userAgent: string;
} {
  return {
    isMobile: isMobileDevice(),
    cores: navigator.hardwareConcurrency ?? 4,
    powerPreference: getPowerPreference(),
    userAgent: navigator.userAgent,
  };
}
