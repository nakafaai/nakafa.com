/**
 * p5's modular entry points ship without types of their own. The core is the
 * same class as the full build, and each addon registers itself with it.
 */
declare module "p5/core" {
  export { default } from "p5";
}

declare module "p5/shape" {
  const addon: Parameters<typeof import("p5").default.registerAddon>[0];
  export default addon;
}

declare module "p5/color" {
  const addon: Parameters<typeof import("p5").default.registerAddon>[0];
  export default addon;
}

declare module "p5/math" {
  const addon: Parameters<typeof import("p5").default.registerAddon>[0];
  export default addon;
}
