import { createContext, type Dispatch, type SetStateAction } from "react";

/**
 * Changes the count of visible pages that hold the nearest shell locked. The app shell provides it, and so
 * does a school's frame, so a page that locks with `ShellLock` takes the whole screen in either.
 */
export const ShellLocksContext = createContext<Dispatch<
  SetStateAction<number>
> | null>(null);
