import { MutableHashMap, Option } from "effect";

/** The storage key of the reload mark of `/en/quran`. */
export const QURAN_MARK = "nakafa:stale-chunk:/en/quran";

/** A tab's storage that holds what the page wrote. */
export function tabStorage() {
  const values = MutableHashMap.empty<string, string>();
  const storage = {
    getItem: (key: string) => Option.getOrNull(MutableHashMap.get(values, key)),
    removeItem: (key: string) => {
      MutableHashMap.remove(values, key);
    },
    setItem: (key: string, value: string) => {
      MutableHashMap.set(values, key, value);
    },
  };
  return storage;
}
