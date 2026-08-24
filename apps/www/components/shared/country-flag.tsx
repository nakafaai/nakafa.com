import { cn } from "@repo/design-system/lib/utils";
import deFlag from "country-flag-icons/string/3x2/DE";
import gbFlag from "country-flag-icons/string/3x2/GB";
import idFlag from "country-flag-icons/string/3x2/ID";
import sgFlag from "country-flag-icons/string/3x2/SG";
import usFlag from "country-flag-icons/string/3x2/US";
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

const flagSources = {
  DE: parseFlagSource(deFlag),
  GB: parseFlagSource(gbFlag),
  ID: parseFlagSource(idFlag),
  SG: parseFlagSource(sgFlag),
  US: parseFlagSource(usFlag),
};

/** Selects one package-owned SVG without importing the all-country React barrel. */
function getFlagSource(countryCode: string | undefined) {
  switch (countryCode) {
    case "DE":
      return flagSources.DE;
    case "GB":
      return flagSources.GB;
    case "ID":
      return flagSources.ID;
    case "SG":
      return flagSources.SG;
    case "US":
      return flagSources.US;
    default:
      return;
  }
}

/** Renders one supported country flag without dynamic component lookup. */
export function CountryFlagIcon({
  className,
  countryCode,
  fallback = null,
}: {
  className?: string;
  countryCode?: string;
  fallback?: ReactNode;
}) {
  const flagSource = getFlagSource(countryCode);
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
