import {
  setDirectionValidator,
  setFilterValidator,
  setSortValidator,
} from "@repo/backend/convex/tryouts/sets/spec";
import { createLoader, parseAsStringLiteral } from "nuqs/server";

/** URL choices derive from the same contract accepted by the catalog query. */
export const catalogQuery = {
  status: parseAsStringLiteral(
    setFilterValidator.members.map(({ value }) => value)
  ).withDefault("all"),
  sort: parseAsStringLiteral(
    setSortValidator.fields.field.members.map(({ value }) => value)
  ).withDefault("order"),
  direction: parseAsStringLiteral(
    setDirectionValidator.members.map(({ value }) => value)
  ).withDefault("asc"),
};

export const readCatalogQuery = createLoader(catalogQuery);
