import { atomWithStorage } from "jotai/utils";

export const searchAtom = atomWithStorage<boolean>("search:open", false);
