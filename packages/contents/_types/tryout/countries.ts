import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";

/** Reads the source-owned country flag code for one try-out country key. */
export function readTryoutCountryCode(countryKey: string) {
  return TRYOUT_SOURCES.find((source) => source.countryKey === countryKey)
    ?.countryCode;
}
