import {
  ArrowDown01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteSearch,
} from "@repo/design-system/components/ui/autocomplete";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { cn } from "cn";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { Suspense, use, useState } from "react";
import { useTranslations } from "use-intl";
import { CountryFlagIcon } from "@/components/shared/flag";

/** One choice of a region picker: its code, its name, and the symbol a currency writes. */
const RegionChoice = Schema.Struct({
  label: Schema.String,
  symbol: Schema.optionalKey(Schema.String),
  value: Schema.String,
});
type RegionChoice = typeof RegionChoice.Type;

/** Every flag the flag package ships, as SVG text by country code, loaded when a country list first opens. */
const loadFlags = () =>
  import("country-flag-icons/string/3x2").then(
    (flags): Readonly<Record<string, string>> => ({ ...flags })
  );

/**
 * A searchable choice among every country or every currency: a button that shows the
 * chosen one, and a popover with a search field over the whole list. A country shows
 * its flag, which loads with the list, and a currency its symbol.
 */
export function RegionPicker({
  choices,
  id,
  kind,
  onChoose,
  value,
}: {
  choices: readonly RegionChoice[];
  id: string;
  kind: "country" | "currency";
  onChoose: (value: string) => void;
  value: string;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [flags] = useState(() => (kind === "country" ? loadFlags() : null));
  const chosen = Arr.findFirst(choices, (choice) => choice.value === value);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            className="w-full justify-start data-open:[&>svg:last-child]:rotate-180"
            id={id}
            type="button"
            variant="outline"
          />
        }
      >
        {flags === null ? (
          <RegionSymbol symbol={Option.getOrUndefined(chosen)?.symbol} />
        ) : (
          <Suspense fallback={<CountryFlagIcon countryCode={value} />}>
            <RegionFlag code={value} flags={flags} />
          </Suspense>
        )}
        <span className="truncate">
          {Option.match(chosen, {
            onNone: () => value,
            onSome: (choice) => choice.label,
          })}
        </span>
        <HugeIcons
          className="ml-auto size-4 transition-transform ease-out"
          icon={ArrowDown01Icon}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-72"
        flush
      >
        <Autocomplete
          autoHighlight="always"
          inline
          items={choices}
          itemToStringValue={(choice) => `${choice.label} ${choice.value}`}
          keepHighlight
          open
        >
          <AutocompleteSearch
            clearLabel={common("clear-search")}
            placeholder={t(
              kind === "country"
                ? "locale-country-search"
                : "locale-currency-search"
            )}
          />
          <AutocompleteEmpty>{t("locale-empty")}</AutocompleteEmpty>
          <AutocompleteList className="max-h-72" scrollArea={false}>
            {(choice: RegionChoice) => (
              <AutocompleteItem
                className="min-h-8 py-1.5 text-sm sm:min-h-8"
                key={choice.value}
                onClick={() => {
                  setOpen(false);
                  onChoose(choice.value);
                }}
                value={choice}
              >
                {flags === null ? (
                  <RegionSymbol symbol={choice.symbol} />
                ) : (
                  <Suspense fallback={<span className="size-4 shrink-0" />}>
                    <RegionFlag code={choice.value} flags={flags} />
                  </Suspense>
                )}
                <span className="truncate">{choice.label}</span>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                  {choice.value}
                </span>
                <HugeIcons
                  className={cn(
                    "size-4 opacity-0 transition-opacity ease-out",
                    choice.value === value && "opacity-100"
                  )}
                  icon={Tick01Icon}
                />
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </Autocomplete>
      </PopoverContent>
    </Popover>
  );
}

/** The flag of one country, drawn from the flags once they load. */
function RegionFlag({
  code,
  flags,
}: {
  code: string;
  flags: Promise<Readonly<Record<string, string>>>;
}) {
  return (
    <CountryFlagIcon
      countryCode={code}
      fallback={<span className="size-4 shrink-0" />}
      source={Option.getOrUndefined(Rec.get(use(flags), code))}
    />
  );
}

/** The symbol a currency writes, in a box as wide as a flag. */
function RegionSymbol({ symbol }: { symbol: string | undefined }) {
  return (
    <span className="text-muted-foreground min-w-4 shrink-0 text-center text-xs font-medium tabular-nums">
      {symbol}
    </span>
  );
}
