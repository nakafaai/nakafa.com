import {
  setDirectionValidator,
  setFilterValidator,
  setSortValidator,
} from "@repo/backend/confect/tryouts/sets/spec";
import { createLoader, parseAsStringLiteral } from "nuqs/server";

/** URL choices derive from the same contract accepted by the catalog query. */
export const catalogQuery = {
  status: parseAsStringLiteral(setFilterValidator.literals).withDefault("all"),
  sort: parseAsStringLiteral(
    setSortValidator.fields.field.literals
  ).withDefault("order"),
  direction: parseAsStringLiteral(setDirectionValidator.literals).withDefault(
    "asc"
  ),
};

export const readCatalogQuery = createLoader(catalogQuery);
