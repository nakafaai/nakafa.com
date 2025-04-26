import { atomWithStorage } from "jotai/utils";

export const searchAtom = atomWithStorage<boolean>("search:open", false);
export const queryAtom = atomWithStorage<string>("search:query", "");
