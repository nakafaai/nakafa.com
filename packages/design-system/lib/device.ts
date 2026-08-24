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
