/**
 * The part of `subset-font` that the Allo generator calls. The package ships no
 * types, and `@types/subset-font` lacks `keepFeatures`.
 */
declare module "subset-font" {
  /** One axis pinned to a value, or limited to a range. */
  type VariationAxis =
    | number
    | { readonly max: number; readonly min: number; readonly default?: number };

  /** How hb-subset instances and subsets the font. */
  interface SubsetOptions {
    readonly keepFeatures?: readonly string[];
    readonly targetFormat?: "sfnt" | "truetype" | "woff" | "woff2";
    readonly variationAxes?: Readonly<Record<string, VariationAxis>>;
  }

  /** Subsets `font` to the characters of `text`, in hb-subset through harfbuzzjs. */
  export default function subsetFont(
    font: Buffer,
    text: string,
    options?: SubsetOptions
  ): Promise<Buffer>;
}
