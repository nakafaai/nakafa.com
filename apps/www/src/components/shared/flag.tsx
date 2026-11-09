import { cn } from "cn";
import deFlag from "country-flag-icons/string/3x2/DE";
import gbFlag from "country-flag-icons/string/3x2/GB";
import idFlag from "country-flag-icons/string/3x2/ID";
import sgFlag from "country-flag-icons/string/3x2/SG";
import usFlag from "country-flag-icons/string/3x2/US";
import { Option, Record as Rec } from "effect";
import type { ReactNode } from "react";

function parseFlagSource(source: string) {
  const bodyStart = source.indexOf(">");
  const bodyEnd = source.lastIndexOf("</svg>");
  const viewBoxStart = source.indexOf('viewBox="');
  const viewBoxEnd = source.indexOf('"', viewBoxStart + 9);

  if (
    bodyStart === -1 ||
    bodyEnd === -1 ||
    viewBoxStart === -1 ||
    viewBoxEnd === -1
  ) {
    return;
  }

  return {
    body: source.slice(bodyStart + 1, bodyEnd),
    viewBox: source.slice(viewBoxStart + 9, viewBoxEnd),
  };
}

/**
 * The Jalur Gemilang in its official proportion of 1:2: fourteen stripes, the
 * canton half the width and eight stripes high, and the fourteen-point Federal
 * Star beside the crescent. The flag package draws every country at 3:2, which
 * would distort a flag the Emblems and Names Act 1963 protects.
 */
const MALAYSIA_FLAG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 684 342"><path fill="#FFF" d="M0 0h684v342H0z"/><path fill="#c00" d="M0 0.0h684v24.4H0zM0 48.9h684v24.4H0zM0 97.7h684v24.4H0zM0 146.6h684v24.4H0zM0 195.4h684v24.4H0zM0 244.3h684v24.4H0zM0 293.1h684v24.4H0z"/><path fill="#006" d="M0 0h342v195.4H0z"/><g transform="translate(42.75 0)" fill="#fc0"><path d="M153.3 42.1C122.6 30.7 88.5 46.3 77.1 77s4.2 64.8 34.9 76.2c13.3 5 28 5 41.4 0-30.7 24.5-75.4 19.6-100-11.1s-19.6-75.4 11.1-100c26-20.7 62.9-20.7 88.8 0z"/><path d="M180.0 51.7L185.1 75.3L200.0 56.3L194.3 79.7L216.0 69.0L200.7 87.7L224.8 87.5L203.0 97.7L224.8 108.0L200.7 107.7L216.0 126.4L194.3 115.7L200.0 139.2L185.1 120.1L180.0 143.7L174.9 120.1L160.0 139.2L165.7 115.7L144.0 126.4L159.3 107.7L135.2 108.0L157.0 97.7L135.2 87.5L159.3 87.7L144.0 69.0L165.7 79.7L160.0 56.3L174.9 75.3z"/></g></svg>';

const flagSources = {
  DE: parseFlagSource(deFlag),
  GB: parseFlagSource(gbFlag),
  ID: parseFlagSource(idFlag),
  MY: parseFlagSource(MALAYSIA_FLAG),
  SG: parseFlagSource(sgFlag),
  US: parseFlagSource(usFlag),
};

/** A country code with a bundled flag; onboarding regions use the same set. */
export type RegionCountryCode = keyof typeof flagSources;

/** Selects one package-owned SVG without importing the all-country React barrel. */
function getFlagSource(countryCode: string | undefined) {
  return Option.getOrUndefined(
    Option.flatMap(Option.fromNullishOr(countryCode), (code) =>
      Rec.get<string, ReturnType<typeof parseFlagSource>>(flagSources, code)
    )
  );
}

/**
 * Renders one country flag without dynamic component lookup: a bundled one, or the SVG
 * text of any other the caller loaded from the same package.
 */
export function CountryFlagIcon({
  className,
  countryCode,
  fallback = null,
  source,
}: {
  className?: string;
  countryCode?: string | undefined;
  fallback?: ReactNode;
  source?: string | undefined;
}) {
  const flagSource =
    source === undefined ? getFlagSource(countryCode) : parseFlagSource(source);
  if (!flagSource) {
    return fallback;
  }

  return (
    <svg
      aria-hidden
      className={cn("size-4 shrink-0", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: The installed package owns these static SVG strings and no user input reaches this boundary.
      dangerouslySetInnerHTML={{ __html: flagSource.body }}
      viewBox={flagSource.viewBox}
      xmlns="http://www.w3.org/2000/svg"
    />
  );
}
