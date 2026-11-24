import { Array as Arr, Option, Schema } from "effect";

export const TaxonOrganismSchema = Schema.Literals([
  "tiger",
  "leopard",
  "leopardCat",
  "sunBear",
  "tapir",
  "hornbill",
  "birdwing",
  "padi",
]);
export type TaxonOrganism = typeof TaxonOrganismSchema.Type;

export const TaxonRankSchema = Schema.Literals([
  "kingdom",
  "phylum",
  "class",
  "order",
  "family",
  "genus",
  "species",
]);
export type TaxonRank = typeof TaxonRankSchema.Type;

export const TAXON_RANKS: readonly TaxonRank[] = TaxonRankSchema.literals;

const LineageSchema = Schema.Record(TaxonRankSchema, Schema.String);
export type Lineage = typeof LineageSchema.Type;

/**
 * Full seven-rank taxonomic lineages for the eight organisms, from kingdom
 * down to species.
 */
const LINEAGES: Readonly<Record<TaxonOrganism, Lineage>> = {
  birdwing: {
    class: "Insecta",
    family: "Papilionidae",
    genus: "Trogonoptera",
    kingdom: "Animalia",
    order: "Lepidoptera",
    phylum: "Arthropoda",
    species: "Trogonoptera brookiana",
  },
  hornbill: {
    class: "Aves",
    family: "Bucerotidae",
    genus: "Buceros",
    kingdom: "Animalia",
    order: "Bucerotiformes",
    phylum: "Chordata",
    species: "Buceros rhinoceros",
  },
  leopard: {
    class: "Mammalia",
    family: "Felidae",
    genus: "Panthera",
    kingdom: "Animalia",
    order: "Carnivora",
    phylum: "Chordata",
    species: "Panthera pardus",
  },
  leopardCat: {
    class: "Mammalia",
    family: "Felidae",
    genus: "Prionailurus",
    kingdom: "Animalia",
    order: "Carnivora",
    phylum: "Chordata",
    species: "Prionailurus bengalensis",
  },
  padi: {
    class: "Liliopsida",
    family: "Poaceae",
    genus: "Oryza",
    kingdom: "Plantae",
    order: "Poales",
    phylum: "Tracheophyta",
    species: "Oryza sativa",
  },
  sunBear: {
    class: "Mammalia",
    family: "Ursidae",
    genus: "Helarctos",
    kingdom: "Animalia",
    order: "Carnivora",
    phylum: "Chordata",
    species: "Helarctos malayanus",
  },
  tapir: {
    class: "Mammalia",
    family: "Tapiridae",
    genus: "Tapirus",
    kingdom: "Animalia",
    order: "Perissodactyla",
    phylum: "Chordata",
    species: "Tapirus indicus",
  },
  tiger: {
    class: "Mammalia",
    family: "Felidae",
    genus: "Panthera",
    kingdom: "Animalia",
    order: "Carnivora",
    phylum: "Chordata",
    species: "Panthera tigris",
  },
};

/** Returns the seven-rank classification lineage of one organism. */
export function lineageOf(organism: TaxonOrganism): Lineage {
  return LINEAGES[organism];
}

/**
 * Compares two organisms from kingdom down to species and returns the count
 * of consecutive shared ranks plus the lowest shared rank and taxon name.
 */
export function compareTaxons(first: TaxonOrganism, second: TaxonOrganism) {
  const left = LINEAGES[first];
  const right = LINEAGES[second];
  const firstDiff = Arr.findFirstIndex(
    TAXON_RANKS,
    (rank) => left[rank] !== right[rank]
  );
  const count = Option.getOrElse(firstDiff, () => TAXON_RANKS.length);
  const lowestRank =
    count > 0 ? Arr.get(TAXON_RANKS, count - 1) : Option.none<TaxonRank>();
  const lowestTaxon = Option.map(lowestRank, (rank) => left[rank]);
  return { count, lowestRank, lowestTaxon };
}
