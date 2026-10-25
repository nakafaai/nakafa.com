import { Cancel01Icon, Search02Icon } from "@hugeicons/core-free-icons";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { getRouteApi, useLocation } from "@tanstack/react-router";
import { cn } from "cn";
import { useTranslations } from "use-intl";
import { useSearch } from "@/lib/search/context";
import { readSearchQuery } from "@/lib/search/input";

const searchRoute = getRouteApi("/$locale/_main/_app/search");

export function InputSearch() {
  const t = useTranslations("Utils");
  const setQuery = useSearch((state) => state.setQuery);
  const navigate = searchRoute.useNavigate();

  /**
   * The controlled value reads the location, which a navigation updates at once. A
   * route match commits later, and a value that waits for it would drop keystrokes.
   */
  const q = useLocation({
    select: (location) => readSearchQuery(location.search),
  });

  const setValue = (value: string) => {
    navigate({
      hash: true,
      replace: true,
      resetScroll: false,
      search: (previous) => ({ ...previous, q: value }),
      state: true,
    });
    setQuery(value);
  };

  return (
    <div className="sticky top-20 lg:top-4">
      <Field>
        <FieldLabel className="sr-only" htmlFor="search-input">
          Search
        </FieldLabel>
        <InputGroup className="bg-background">
          <InputGroupInput
            id="search-input"
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("search-bar-placeholder")}
            value={q}
          />
          <InputGroupAddon align="inline-start">
            <HugeIcons className="size-4" icon={Search02Icon} />
          </InputGroupAddon>
          <InputGroupAddon
            align="inline-end"
            className={cn("opacity-0", q && "opacity-100")}
          >
            <InputGroupButton
              aria-label={t("clear-search")}
              onClick={() => setValue("")}
              size="icon-xs"
            >
              <HugeIcons className="size-4" icon={Cancel01Icon} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </div>
  );
}
