import { createContext } from "react";

/** Whether more rows may still arrive for the table inside (`TablePages`), so it holds its empty states until they do. */
export const TableWaitingContext = createContext(false);
