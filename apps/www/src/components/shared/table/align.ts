import { Schema } from "effect";
import { createContext } from "react";

/** Where a column head's button stands in its cell. */
export const HeadAlign = Schema.Literals(["center", "end", "start"]);

/**
 * The place of the head buttons under it, for a column whose head a shared component draws: the table's first
 * column at the start, its last column of figures at the end.
 */
export const HeadAlignContext = createContext<typeof HeadAlign.Type>("center");
