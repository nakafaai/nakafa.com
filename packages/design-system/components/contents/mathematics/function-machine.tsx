import {
  ArrowDown02Icon,
  ArrowRight02Icon,
  MinusSignIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Button as UiButton } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { type ReactNode, useState } from "react";
import {
  Button,
  Group,
  Input,
  Label,
  NumberField,
} from "react-aria-components";
import { useFormatter, useTranslations } from "use-intl";

const DEFAULT_INPUT = 5;

interface Props {
  description: ReactNode;
  inputLabel: string;
  title: ReactNode;
}

/** Renders the interactive function-machine lesson card: its input and output controls, and its values. */
export function FunctionMachine({ title, description, inputLabel }: Props) {
  const t = useTranslations("Common");
  const format = useFormatter();
  const [input, setInput] = useState<number>(DEFAULT_INPUT);
  const output = 2 * input + 1;
  const formatNumber = (value: number) =>
    mathNumber(format.number(value, MATH_NUMBER_OPTIONS));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <NumberField
          formatOptions={{
            localeMatcher: "best fit",
          }}
          onChange={setInput}
          value={input}
        >
          {/* biome-ignore lint/a11y/noLabelWithoutControl: React Aria connects this Label to the NumberField input through context. */}
          <Label className="sr-only">{inputLabel}</Label>
          <Group className="relative inline-flex h-9 w-full items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-3 data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
            <Button
              className="flex aspect-square h-[inherit] cursor-pointer items-center justify-center border-input border-e bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              slot="decrement"
            >
              <HugeIcons
                aria-hidden="true"
                className="size-4"
                icon={MinusSignIcon}
              />
            </Button>
            <Input className="w-full grow bg-background px-3 py-2 text-center font-mono text-foreground tabular-nums" />
            <Button
              className="flex aspect-square h-[inherit] cursor-pointer items-center justify-center border-input border-s bg-background text-muted-foreground text-sm transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
              slot="increment"
            >
              <HugeIcons
                aria-hidden="true"
                className="size-4"
                icon={PlusSignIcon}
              />
            </Button>
          </Group>
        </NumberField>
      </VisualCardToolbar>

      <VisualCardBody>
        <div className="flex flex-col items-center justify-center gap-8 px-(--card-spacing) py-8 sm:flex-row">
          <UiButton className="pointer-events-none" variant="default">
            <InlineMath math={`x = ${input}`} />
          </UiButton>

          <HugeIcons
            className="hidden size-4 sm:block"
            icon={ArrowRight02Icon}
          />
          <HugeIcons
            className="block size-4 sm:hidden"
            icon={ArrowDown02Icon}
          />

          <div className="flex items-center justify-center rounded-md bg-accent p-8 text-accent-foreground shadow-xs">
            <InlineMath math="f(x) = 2x + 1" />
          </div>

          <HugeIcons
            className="block size-4 sm:hidden"
            icon={ArrowDown02Icon}
          />
          <HugeIcons
            className="hidden size-4 sm:block"
            icon={ArrowRight02Icon}
          />

          <UiButton className="pointer-events-none" variant="secondary">
            <InlineMath math={`f(x) = ${output}`} />
          </UiButton>
        </div>
      </VisualCardBody>

      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={t("input")}
            value={<InlineMath math={formatNumber(input)} />}
          />
          <VisualFact
            label={t("output")}
            value={<InlineMath math={formatNumber(output)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
