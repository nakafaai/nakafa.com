import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Picker,
  PickerContent,
  PickerItem,
  PickerTrigger,
} from "@repo/design-system/components/ui/picker";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import {
  createContext,
  type ReactElement,
  Suspense,
  use,
  useState,
} from "react";
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

/** The flags of a country picker, loading from its first draw; a currency picker has none. */
const RegionFlags = createContext<Promise<
  Readonly<Record<string, string>>
> | null>(null);

/**
 * A searchable choice among every country or every currency: a button that shows the chosen one, and the picker's
 * search over the whole list. A country shows its flag, which loads with the list, and a currency its symbol.
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
  const [flags] = useState(() => (kind === "country" ? loadFlags() : null));
  const chosen = Arr.findFirst(choices, (choice) => choice.value === value);

  return (
    <RegionFlags value={flags}>
      <Picker>
        <PickerTrigger
          id={id}
          render={
            <Button
              className="w-full justify-start data-open:[&>svg:last-child]:rotate-180"
              type="button"
              variant="outline"
            />
          }
        >
          {flags === null ? (
            <RegionSymbol symbol={Option.getOrUndefined(chosen)?.symbol} />
          ) : (
            <Suspense fallback={<CountryFlagIcon countryCode={value} />}>
              <RegionFlag code={value} />
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
        </PickerTrigger>
        <PickerContent
          empty={t("locale-empty")}
          items={choices}
          itemToStringValue={(choice) => `${choice.label} ${choice.value}`}
          label={
            kind === "country"
              ? common("menu-country")
              : common("menu-currency")
          }
          placeholder={t(
            kind === "country"
              ? "locale-country-search"
              : "locale-currency-search"
          )}
        >
          {(choice) => (
            <RegionOption
              choice={choice}
              icon={
                flags === null ? (
                  <RegionSymbol symbol={choice.symbol} />
                ) : (
                  <Suspense fallback={<span className="size-4 shrink-0" />}>
                    <RegionFlag code={choice.value} />
                  </Suspense>
                )
              }
              key={choice.value}
              onChoose={() => onChoose(choice.value)}
              selected={choice.value === value}
            />
          )}
        </PickerContent>
      </Picker>
    </RegionFlags>
  );
}

/** One country or currency of the picker: its mark, its name, and its code at the end of the row. */
function RegionOption({
  choice,
  icon,
  onChoose,
  selected,
}: {
  choice: RegionChoice;
  icon: ReactElement;
  onChoose: () => void;
  selected: boolean;
}) {
  return (
    <PickerItem
      icon={icon}
      onClick={onChoose}
      selected={selected}
      value={choice}
    >
      <span className="truncate">{choice.label}</span>
      <span className="text-muted-foreground ml-auto text-xs tabular-nums">
        {choice.value}
      </span>
    </PickerItem>
  );
}

/** The flag of one country, drawn from the picker's flags once they load. */
function RegionFlag({ code }: { code: string }) {
  const flags = useRequired(RegionFlags, "RegionFlag");
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
