import {
  RenderableSpec,
  ResponseRejected,
  type Selected,
  type Selection,
} from "@repo/backend/confect/response/model";
import {
  Array as Arr,
  HashMap,
  HashSet,
  Option,
  pipe,
  Result,
  String as Str,
  Tuple,
} from "effect";

type Kind = RenderableSpec["kind"];
type SpecOf<K extends Kind> = (typeof RenderableSpec.cases)[K]["Type"];
type SelectionOf<K extends Kind> = (typeof Selection.cases)[K]["Type"];
type Selecting = Result.Result<Selected, ResponseRejected>;

/** Rejects one selection with the reason it does not belong to its response. */
function reject(reason: ResponseRejected["reason"]) {
  return Result.fail(new ResponseRejected({ reason }));
}

/** Reports whether a learner typed anything besides whitespace. */
function isWritten(text: string) {
  return Str.isNonEmpty(Str.trim(text));
}

/**
 * Checks that one learner selection belongs to its response and returns it in
 * canonical order. A short answer or rubric must carry typed text: an empty
 * answer is cleared, never selected. Reading typed numbers needs the answer
 * key, so it belongs to `evaluate`, whose comment explains why both return a
 * `Result`.
 */
export function select(spec: RenderableSpec, selection: Selection): Selecting {
  return RenderableSpec.match(spec, {
    category: (spec) =>
      selection.kind === "category"
        ? selectCategory(spec, selection)
        : reject("kind"),
    "multiple-choice": (spec) =>
      selection.kind === "multiple-choice"
        ? selectMultipleChoice(spec, selection)
        : reject("kind"),
    rubric: (spec) =>
      selection.kind === "rubric"
        ? selectRubric(spec, selection)
        : reject("kind"),
    "short-answer": () =>
      selection.kind === "short-answer"
        ? selectShortAnswer(selection)
        : reject("kind"),
    "single-choice": (spec) =>
      selection.kind === "single-choice"
        ? selectSingleChoice(spec, selection)
        : reject("kind"),
  });
}

/** Requires one existing option. */
function selectSingleChoice(
  spec: SpecOf<"single-choice">,
  selection: SelectionOf<"single-choice">
): Selecting {
  return Arr.some(
    spec.options,
    ({ optionKey }) => optionKey === selection.optionKey
  )
    ? Result.succeed({
        isComplete: true,
        selection: { kind: selection.kind, optionKey: selection.optionKey },
      })
    : reject("selection");
}

/** Requires a non-empty set of distinct existing options, in authored order. */
function selectMultipleChoice(
  spec: SpecOf<"multiple-choice">,
  selection: SelectionOf<"multiple-choice">
): Selecting {
  const requested = HashSet.fromIterable(selection.optionKeys);
  const available = HashSet.fromIterable(
    Arr.map(spec.options, ({ optionKey }) => optionKey)
  );
  if (
    HashSet.size(requested) === 0 ||
    HashSet.size(requested) !== selection.optionKeys.length ||
    !HashSet.isSubset(requested, available)
  ) {
    return reject("selection");
  }
  return Result.succeed({
    isComplete: true,
    selection: {
      kind: selection.kind,
      optionKeys: pipe(
        spec.options,
        Arr.map(({ optionKey }) => optionKey),
        Arr.filter((optionKey) => HashSet.has(requested, optionKey))
      ),
    },
  });
}

/**
 * Requires at least one assignment of an existing statement to an existing
 * category, each statement once, in authored statement order. The answer is
 * complete when every statement is assigned.
 */
function selectCategory(
  spec: SpecOf<"category">,
  selection: SelectionOf<"category">
): Selecting {
  const categories = HashSet.fromIterable(
    Arr.map(spec.categories, ({ categoryKey }) => categoryKey)
  );
  const statements = HashSet.fromIterable(
    Arr.map(spec.statements, ({ statementKey }) => statementKey)
  );
  const assignments = HashMap.fromIterable(
    Arr.map(selection.assignments, ({ categoryKey, statementKey }) =>
      Tuple.make(statementKey, categoryKey)
    )
  );
  if (
    HashMap.size(assignments) === 0 ||
    HashMap.size(assignments) !== selection.assignments.length ||
    !Arr.every(
      selection.assignments,
      ({ categoryKey, statementKey }) =>
        HashSet.has(categories, categoryKey) &&
        HashSet.has(statements, statementKey)
    )
  ) {
    return reject("selection");
  }
  const canonical = Arr.getSomes(
    Arr.map(spec.statements, ({ statementKey }) =>
      Option.map(HashMap.get(assignments, statementKey), (categoryKey) => ({
        categoryKey,
        statementKey,
      }))
    )
  );
  return Result.succeed({
    isComplete: canonical.length === spec.statements.length,
    selection: { assignments: canonical, kind: selection.kind },
  });
}

/** Requires typed text; the raw text is kept for the grader. */
function selectShortAnswer(selection: SelectionOf<"short-answer">): Selecting {
  return isWritten(selection.text)
    ? Result.succeed({
        isComplete: true,
        selection: { kind: selection.kind, text: selection.text },
      })
    : reject("selection");
}

/**
 * Accepts a written response, typed final answers, or both. Each final answer
 * names one final-answer criterion once and is typed. The response is complete
 * when every final answer is typed and, when a criterion is judged, the
 * response is written.
 */
function selectRubric(
  spec: SpecOf<"rubric">,
  selection: SelectionOf<"rubric">
): Selecting {
  const finals = pipe(
    spec.criteria,
    Arr.filter(({ final }) => final),
    Arr.map(({ criterionKey }) => criterionKey),
    HashSet.fromIterable
  );
  const answers = HashMap.fromIterable(
    Arr.map(selection.finalAnswers, ({ criterionKey, text }) =>
      Tuple.make(criterionKey, text)
    )
  );
  const written = isWritten(selection.text);
  if (
    HashMap.size(answers) !== selection.finalAnswers.length ||
    !Arr.every(
      selection.finalAnswers,
      ({ criterionKey, text }) =>
        HashSet.has(finals, criterionKey) && isWritten(text)
    ) ||
    !(written || HashMap.size(answers) > 0)
  ) {
    return reject("selection");
  }
  const finalAnswers = Arr.getSomes(
    Arr.map(spec.criteria, ({ criterionKey }) =>
      Option.map(HashMap.get(answers, criterionKey), (text) => ({
        criterionKey,
        text,
      }))
    )
  );
  const judged = Arr.some(spec.criteria, ({ final }) => !final);
  return Result.succeed({
    isComplete:
      finalAnswers.length === HashSet.size(finals) && (written || !judged),
    selection: { finalAnswers, kind: selection.kind, text: selection.text },
  });
}
