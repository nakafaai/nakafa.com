import { parseAsString } from "nuqs/server";

export const searchParsers = {
  q: parseAsString.withDefault(""),
};
