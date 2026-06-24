"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/ai/schema/data";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { formulaExpressionForComputation } from "@repo/math/project/formula";
import type { VisualIntent } from "@repo/math/schema/artifact";
import type { MathCopyKey } from "@repo/math/schema/copy";
import type { MathWorkStepEncoded } from "@repo/math/schema/step";
import type {
  MathComputation,
  MathWorkResultEncoded,
} from "@repo/math/schema/work";
import { useTranslations } from "next-intl";

import {
  type MathCopyTranslator,
  translateMathCopy,
} from "@/components/ai/message-part/math/copy";
import { Expression } from "@/components/ai/message-part/math/expression";

interface MathEvidenceProps {
  message: DataPart["math"];
}

interface WorkViewProps {
  result: MathWorkResultEncoded;
  t: MathCopyTranslator;
}

interface FormulaViewProps {
  computation: MathComputation | undefined;
  t: MathCopyTranslator;
  titleKey: MathCopyKey;
}

interface StepListProps {
  steps: readonly MathWorkStepEncoded[];
  t: MathCopyTranslator;
}

interface StepRowProps {
  number: number;
  step: MathWorkStepEncoded;
  t: MathCopyTranslator;
}

interface NoteListProps {
  notes: MathWorkResultEncoded["work"]["assumptions"];
  t: MathCopyTranslator;
  titleKey: MathCopyKey;
}

interface VisualIntentViewProps {
  intent: VisualIntent;
  t: MathCopyTranslator;
}

/** Renders localized MathWork evidence without CAS transport semantics. */
export function MathEvidence({ message }: MathEvidenceProps) {
  const t = useTranslations("Ai");
  const translate: MathCopyTranslator = (key, values) => t(key, values);

  if (message.status === "loading") {
    return <p>{translateMathCopy({ key: "math-loading", t: translate })}</p>;
  }

  if (message.status === "error") {
    return (
      <p className="text-muted-foreground">
        {translateMathCopy({ key: "math-error", t: translate })}
      </p>
    );
  }

  return <WorkView result={message.result} t={translate} />;
}

/** Renders the complete localized MathWork projection. */
function WorkView({ result, t }: WorkViewProps) {
  const formulaArtifact = result.artifacts.find(
    (artifact) => artifact.kind === "formula-card"
  );
  const visualIntent = findVisualIntent(result);

  return (
    <div className="flex max-w-full flex-col gap-3">
      <FormulaView
        computation={result.work.computations[0]}
        t={t}
        titleKey={formulaArtifact?.titleKey ?? "math-work-formula-title"}
      />
      <p className="text-muted-foreground/90">
        {translateMathCopy({
          key: result.work.verification.reasonKey,
          t,
          values: result.work.verification.values,
        })}
      </p>
      <StepList steps={result.steps} t={t} />
      <NoteList
        notes={result.work.assumptions}
        t={t}
        titleKey="math-work-assumptions-title"
      />
      <NoteList
        notes={result.work.limitations}
        t={t}
        titleKey="math-work-limitations-title"
      />
      {visualIntent ? <VisualIntentView intent={visualIntent} t={t} /> : null}
    </div>
  );
}

/** Renders the primary formula card from normalized computation evidence. */
function FormulaView({ computation, titleKey, t }: FormulaViewProps) {
  if (!computation) {
    return null;
  }

  const expression = formulaExpressionForComputation(computation);

  return (
    <div className="flex max-w-full flex-col gap-1">
      <span className="text-muted-foreground/80">
        {translateMathCopy({ key: titleKey, t })}
      </span>
      <Expression value={expression.latex} />
    </div>
  );
}

/** Renders localized semantic derivation steps. */
function StepList({ steps, t }: StepListProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-col gap-2">
      {steps.map((step, index) => (
        <StepRow
          key={`${step.workId}-${step.order}-${step.ruleId}`}
          number={index + 1}
          step={step}
          t={t}
        />
      ))}
    </div>
  );
}

/** Renders one localized semantic derivation step. */
function StepRow({ number, step, t }: StepRowProps) {
  return (
    <div className="grid max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
      <span className="flex shrink-0 items-center gap-2 text-muted-foreground/80">
        <span>{t("math-step", { number: String(number) })}</span>
        <HugeIcons className="size-3.5 shrink-0" icon={ArrowRight02Icon} />
      </span>
      <span className="min-w-0 text-muted-foreground/90">
        {translateMathCopy({
          key: step.projection.school.key,
          t,
          values: step.projection.school.values,
        })}
      </span>
      <span className="col-start-2 flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 overflow-x-auto overflow-y-hidden">
        <Expression value={step.input.latex} />
        <HugeIcons className="size-3.5 shrink-0" icon={ArrowRight02Icon} />
        <Expression value={step.output.latex} />
      </span>
    </div>
  );
}

/** Renders localized MathWork notes such as planning assumptions. */
function NoteList({ notes, titleKey, t }: NoteListProps) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-col gap-1 text-muted-foreground/90">
      <span className="text-muted-foreground/80">
        {translateMathCopy({ key: titleKey, t })}
      </span>
      {notes.map((note) => (
        <span key={`${note.copyKey}-${note.source ?? "work"}`}>
          {translateMathCopy({
            key: note.copyKey,
            t,
            values: note.values,
          })}
        </span>
      ))}
    </div>
  );
}

/** Renders the localized description for structured coordinate visual intent. */
function VisualIntentView({ intent, t }: VisualIntentViewProps) {
  return (
    <div className="flex max-w-full flex-col gap-1 text-muted-foreground/90">
      <span>
        {translateMathCopy({
          key: intent.descriptionKey,
          t,
        })}
      </span>
      {intent.expressions.map((expression) => (
        <Expression
          key={`${intent.kind}-${expression.expression}`}
          value={expression.latex}
        />
      ))}
    </div>
  );
}

/** Finds the structured visual intent artifact for a MathWork result. */
function findVisualIntent(result: MathWorkResultEncoded) {
  const artifact = result.artifacts.find(
    (item) => item.manifest.kind === "visual-intent"
  );

  if (artifact?.manifest.kind !== "visual-intent") {
    return;
  }

  return artifact.manifest.visualIntent;
}
