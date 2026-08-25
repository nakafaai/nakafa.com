import type { MDXComponents } from "@repo/design-system/types/markdown";

/** One signed renderer name and its independently loadable implementation. */
export interface RendererComponentLoader {
  readonly load: () => Promise<MDXComponents[string]>;
  readonly name: string;
}

/** Physical loader module selected through one literal domain import. */
export interface RendererDomainModule {
  readonly domainComponentLoaders: readonly RendererComponentLoader[];
}
