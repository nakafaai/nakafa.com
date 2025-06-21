const MOBILE_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
export function isMobileDevice(): boolean {
  return MOBILE_REGEX.test(navigator.userAgent);
}
