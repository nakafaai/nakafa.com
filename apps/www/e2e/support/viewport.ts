/** The widest viewport every responsive suite walks. */
export const desktopViewport = {
  hasTouch: false,
  height: 900,
  name: "desktop",
  width: 1440,
} as const;

/** The phone viewport that takes touch input. */
const touchViewport = {
  hasTouch: true,
  height: 844,
  name: "touch",
  width: 390,
} as const;

/** The viewports the responsive suites walk, from a compact phone to desktop. */
export const targetViewports = [
  { hasTouch: false, height: 800, name: "compact", width: 320 },
  touchViewport,
  { hasTouch: false, height: 1024, name: "tablet-portrait", width: 768 },
  { hasTouch: false, height: 768, name: "tablet-landscape", width: 1024 },
  desktopViewport,
] as const;

/** The viewports every try-out suite walks. */
export const tryoutViewports = [desktopViewport, touchViewport] as const;
