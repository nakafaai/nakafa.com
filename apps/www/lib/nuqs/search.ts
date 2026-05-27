import { parseAsString } from "nuqs";

export const searchParsers = {
  q: parseAsString.withDefault(""),
};
