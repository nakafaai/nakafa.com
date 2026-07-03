import { cn } from "@repo/design-system/lib/utils";
import GB from "country-flag-icons/react/3x2/GB";
import ID from "country-flag-icons/react/3x2/ID";
import SG from "country-flag-icons/react/3x2/SG";
import US from "country-flag-icons/react/3x2/US";

/** Renders one supported provider-country flag without dynamic component lookup. */
export function CountryFlagIcon({
  className,
  countryCode,
}: {
  className?: string;
  countryCode?: string;
}) {
  const flagClassName = cn("size-4 shrink-0", className);

  switch (countryCode) {
    case "GB":
      return <GB aria-hidden className={flagClassName} />;
    case "ID":
      return <ID aria-hidden className={flagClassName} />;
    case "SG":
      return <SG aria-hidden className={flagClassName} />;
    case "US":
      return <US aria-hidden className={flagClassName} />;
    default:
      return null;
  }
}
