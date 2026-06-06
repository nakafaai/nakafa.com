/**
 * Lets TypeScript treat statically imported MDX files as React components.
 */
declare module "*.mdx" {
  import type { ComponentType } from "react";

  const MdxComponent: ComponentType;
  export default MdxComponent;
}
