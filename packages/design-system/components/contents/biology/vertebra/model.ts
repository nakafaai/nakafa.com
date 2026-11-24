import { Schema } from "effect";

const VertebraRegionSchema = Schema.Literals([
  "cervical",
  "atlas",
  "axis",
  "thoracic",
  "lumbar",
  "sacral",
  "caudal",
]);
export type VertebraRegion = typeof VertebraRegionSchema.Type;

const VertebraPartSchema = Schema.Literals([
  "body",
  "canal",
  "spinous",
  "transverse",
  "foramen",
  "facet",
  "dens",
  "disc",
]);
export type VertebraPart = typeof VertebraPartSchema.Type;

const RegionSpecSchema = Schema.Struct({
  bodyRadius: Schema.Finite,
  columnY: Schema.Finite,
  count: Schema.Int,
  fused: Schema.Boolean,
  hasBody: Schema.Boolean,
  hasDens: Schema.Boolean,
  hasFacet: Schema.Boolean,
  hasForamen: Schema.Boolean,
  spinousLength: Schema.Finite,
});
type RegionSpec = typeof RegionSpecSchema.Type;

/**
 * Cited human vertebral column data matching textbook anatomy:
 * 7 cervical (including 1 atlas and 1 axis), 12 thoracic, 5 lumbar,
 * 5 fused sacral, and 4 fused caudal vertebrae.
 */
const REGION_SPECS: Readonly<Record<VertebraRegion, RegionSpec>> = {
  atlas: {
    bodyRadius: 0.14,
    columnY: 1.56,
    count: 1,
    fused: false,
    hasBody: false,
    hasDens: false,
    hasFacet: false,
    hasForamen: true,
    spinousLength: 0.04,
  },
  axis: {
    bodyRadius: 0.15,
    columnY: 1.44,
    count: 1,
    fused: false,
    hasBody: true,
    hasDens: true,
    hasFacet: false,
    hasForamen: true,
    spinousLength: 0.16,
  },
  caudal: {
    bodyRadius: 0.12,
    columnY: 0.08,
    count: 4,
    fused: true,
    hasBody: true,
    hasDens: false,
    hasFacet: false,
    hasForamen: false,
    spinousLength: 0.05,
  },
  cervical: {
    bodyRadius: 0.16,
    columnY: 1.32,
    count: 7,
    fused: false,
    hasBody: true,
    hasDens: false,
    hasFacet: false,
    hasForamen: true,
    spinousLength: 0.18,
  },
  lumbar: {
    bodyRadius: 0.28,
    columnY: 0.54,
    count: 5,
    fused: false,
    hasBody: true,
    hasDens: false,
    hasFacet: false,
    hasForamen: false,
    spinousLength: 0.2,
  },
  sacral: {
    bodyRadius: 0.24,
    columnY: 0.26,
    count: 5,
    fused: true,
    hasBody: true,
    hasDens: false,
    hasFacet: false,
    hasForamen: false,
    spinousLength: 0.1,
  },
  thoracic: {
    bodyRadius: 0.21,
    columnY: 0.96,
    count: 12,
    fused: false,
    hasBody: true,
    hasDens: false,
    hasFacet: true,
    hasForamen: false,
    spinousLength: 0.32,
  },
};

/** Returns anatomical counts, fusion status, and proportions for one spinal region. */
export function vertebraSpecOf(region: VertebraRegion): RegionSpec {
  return REGION_SPECS[region];
}
