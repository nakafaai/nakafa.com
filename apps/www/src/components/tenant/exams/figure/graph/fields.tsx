import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { lazy } from "@repo/design-system/lib/lazy";
import { Option } from "effect";
import { Suspense, useId } from "react";
import { useTranslations } from "use-intl";
import { useGraph } from "@/components/tenant/exams/figure/graph/provider";

/** The figure's code loads when a dialog first shows one. */
const LazyFigure = lazy(() =>
  import("@/components/assessment/figure").then((module) => ({
    default: module.AssessmentFigure,
  }))
);

/** The figure's name, its card's title. */
export function NameField() {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const title = useGraph((state) => state.draft.title);
  const change = useGraph((state) => state.change);
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{common("name")}</FieldLabel>
      <Input
        dir="auto"
        id={id}
        onChange={(event) => change({ title: event.target.value })}
        placeholder={t("figure-name-placeholder")}
        value={title}
      />
    </Field>
  );
}

/** What the figure shows in words, read aloud to a student who cannot see it. */
export function AltField() {
  const t = useTranslations("Exams");
  const alt = useGraph((state) => state.draft.alt);
  const change = useGraph((state) => state.change);
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t("figure-alt")}</FieldLabel>
      <Input
        dir="auto"
        id={id}
        onChange={(event) => change({ alt: event.target.value })}
        placeholder={t("figure-alt-placeholder")}
        value={alt}
      />
      <FieldDescription>{t("figure-alt-hint")}</FieldDescription>
    </Field>
  );
}

/**
 * The figure as the student reads it, redrawn on every keystroke. While a value is on its way it keeps the
 * last figure it drew and says what still stops it.
 */
export function GraphPreview() {
  const t = useTranslations("Exams");
  const shown = useGraph((state) => state.shown);
  const ready = useGraph((state) => Option.isSome(state.figure));

  return (
    <div className="grid gap-2 lg:sticky lg:top-0 lg:self-start">
      {Option.isSome(shown) ? (
        <Suspense fallback={null}>
          <LazyFigure attrs={shown.value} />
        </Suspense>
      ) : null}
      {ready ? null : (
        <p className="text-muted-foreground text-sm" role="status">
          {t("figure-unready")}
        </p>
      )}
    </div>
  );
}
