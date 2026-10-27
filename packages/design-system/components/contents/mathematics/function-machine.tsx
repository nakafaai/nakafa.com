import { ArrowDown02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Button as UiButton } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
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
          onValueChange={(value) => {
            if (value !== null) {
              setInput(value);
            }
          }}
          value={input}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput
              aria-label={inputLabel}
              className="font-mono"
              placeholder={`${DEFAULT_INPUT}`}
            />
            <NumberFieldIncrement />
          </NumberFieldGroup>
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
