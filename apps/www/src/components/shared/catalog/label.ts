import { createContext } from "react";

/** The label of every card's action in one catalog grid, such as Open, which the grid provides. */
export const CatalogActionLabelContext = createContext<string | null>(null);
