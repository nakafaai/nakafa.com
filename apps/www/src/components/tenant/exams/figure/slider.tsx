import {
  Delete02Icon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { useId } from "react";
import { useTranslations } from "use-intl";
import type { SliderDraft } from "@/components/tenant/exams/figure/plane";
import { useFigure } from "@/components/tenant/exams/figure/provider";
import { isNumber } from "@/components/tenant/exams/figure/shapes";

/** The fields of a slider that hold a number. */
type SliderField = "max" | "min" | "step" | "value";

/** What each number of a slider looks like, shown while its field is empty. */
const SLIDER_EXAMPLE = {
  max: "5",
  min: "-5",
  step: "0.1",
  value: "1",
} as const satisfies Record<SliderField, string>;

/** One number of a slider. */
function SliderInput({
  field,
  label,
  slider,
}: {
  readonly field: SliderField;
  readonly label: string;
  readonly slider: SliderDraft;
}) {
  const changeSlider = useFigure((state) => state.changeSlider);
  const id = useId();
  const value = slider[field];

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        aria-invalid={
          !(isNumber(value) || (field === "step" && value.trim() === ""))
        }
        dir="ltr"
        id={id}
        inputMode="decimal"
        onChange={(event) =>
          changeSlider(slider.id, { [field]: event.target.value })
        }
        placeholder={SLIDER_EXAMPLE[field]}
        value={value}
      />
    </Field>
  );
}

/**
 * One slider a student moves: the letter every formula of the plane may read, its range, where it starts, and
 * its step. A point at (a, a^2) or a function a x^2 follows it.
 */
export function SliderCard({ slider }: { readonly slider: SliderDraft }) {
  const common = useTranslations("Common");
  const t = useTranslations("Exams");
  const removeSlider = useFigure((state) => state.removeSlider);

  return (
    <FieldSet className="gap-3 rounded-lg border p-3">
      <FieldLegend className="flex w-full items-center gap-2" variant="label">
        <HugeIcons
          aria-hidden="true"
          className="text-muted-foreground size-4"
          icon={SlidersHorizontalIcon}
        />
        {t("figure-slider", { name: slider.name })}
        <Button
          className="ms-auto"
          onClick={() => removeSlider(slider.id)}
          size="icon-sm"
          tooltip={common("delete")}
          type="button"
          variant="ghost"
        >
          <HugeIcons aria-hidden="true" icon={Delete02Icon} />
        </Button>
      </FieldLegend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SliderInput field="min" label={t("figure-min")} slider={slider} />
        <SliderInput field="max" label={t("figure-max")} slider={slider} />
        <SliderInput field="value" label={t("figure-start")} slider={slider} />
        <SliderInput field="step" label={t("figure-step")} slider={slider} />
      </div>
    </FieldSet>
  );
}
