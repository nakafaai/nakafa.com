import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { type ComponentProps, useRef } from "react";
import { useTranslations } from "use-intl";

/**
 * A search box: a text input between a search icon and a clear button that shows once the box
 * holds text. Clearing, by the button or by Escape, empties the box and keeps the focus in it;
 * Escape on an empty box reaches the surface around it, such as a dialog that closes. The browser
 * draws no clear control of its own, because the input is a text field.
 */
function SearchField({
  className,
  onValueChange,
  placeholder,
  value,
  ...props
}: Omit<
  ComponentProps<typeof InputGroupInput>,
  "onChange" | "placeholder" | "type" | "value"
> & {
  /** Receives the text of the box on every change, and an empty text when it is cleared. */
  readonly onValueChange: (value: string) => void;
  /** What the box shows while empty, which also names it for assistive technology. */
  readonly placeholder: string;
  /** The text of the box. */
  readonly value: string;
}) {
  const t = useTranslations("Common");
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    onValueChange("");
    input.current?.focus();
  };

  return (
    <InputGroup className={className} data-slot="search-field">
      <InputGroupAddon>
        <HugeIcons icon={Search01Icon} />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={placeholder}
        enterKeyHint="search"
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            event.stopPropagation();
            clear();
          }
        }}
        placeholder={placeholder}
        ref={input}
        role="searchbox"
        type="text"
        value={value}
        {...props}
      />
      {value === "" ? null : (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={t("clear-search")}
            onClick={clear}
            size="icon-xs"
          >
            <HugeIcons icon={Cancel01Icon} />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

export { SearchField };
