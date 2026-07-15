import lookup from "country-code-lookup";

const NUMERIC_COUNTRY_CODE_PATTERN = /^\d+$/;

/**
 * Resolves numeric, ISO, or FIPS country codes while preserving unknown labels.
 */
export function getCountryName(
  countryCode?: string | null
): string | undefined {
  if (!countryCode) {
    return;
  }

  const normalizedCountryCode = countryCode.trim();
  const isIsoCandidate =
    NUMERIC_COUNTRY_CODE_PATTERN.test(normalizedCountryCode) ||
    normalizedCountryCode.length === 2 ||
    normalizedCountryCode.length === 3;

  if (!isIsoCandidate) {
    return countryCode;
  }

  const country =
    lookup.byIso(normalizedCountryCode) || lookup.byFips(normalizedCountryCode);

  return country?.country ?? countryCode;
}
