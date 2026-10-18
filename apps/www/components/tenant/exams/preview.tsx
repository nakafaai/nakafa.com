"use client";

import { QueryResult, useQuery } from "@confect/react";
import { useInViewport } from "@mantine/hooks";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { Input } from "@repo/design-system/components/ui/input";
import { Radio } from "@repo/design-system/components/ui/radio-group";
import { paragraphVariants } from "@repo/design-system/lib/paragraph";
import { DOMSerializer, type Node } from "@tiptap/pm/model";
import { Array as Arr, Effect, HashMap, Option } from "effect";
import { useDeferredValue } from "react";
import {
  choiceOf,
  labelText,
  markedOption,
  optionLetter,
} from "@/components/tenant/exams/answer";
import type { Question } from "@/components/tenant/exams/optimistic";
import { useExam, useExamLive } from "@/components/tenant/exams/provider";
import {
  QuestionSheet,
  QuestionSheetOption,
  QuestionSheetOptions,
  QuestionSheetPrompt,
} from "@/components/tenant/exams/sheet";
import { assessmentSchema } from "@/lib/editor/assessment";
import { foldedDocument } from "@/lib/editor/fold";

/**
 * The session name a thumbnail reads a prompt under. It never writes, so the server holds no
 * record of it, and the read answers the document alone.
 */
const PREVIEW_CLIENT = "preview";

/**
 * What one question looks like on its canvas, drawn at a quarter of the size for the strip:
 * the same page, with its prompt and its options. The open question draws its prompt from
 * the editor on the canvas, so it changes as the teacher types. Any other question reads its
 * prompt once it scrolls into view, and again only when someone edits it. The page is
 * inert: the strip's button names the question.
 */
export function QuestionPreview({
  number,
  open,
  question,
}: {
  number: number;
  open: boolean;
  question: Question;
}) {
  const { slug } = useExam();
  const { inViewport, ref } = useInViewport();
  const docs = useExamLive((state) => state.docs);
  const live = HashMap.get(docs, question.prompt);
  const reply = useQuery(
    editors.documents.open,
    (open && Option.isSome(live)) || !inViewport
      ? "skip"
      : { clientId: PREVIEW_CLIENT, documentId: question.prompt, slug }
  );
  const read = QueryResult.isSuccess(reply)
    ? Option.some(
        Effect.runSync(
          foldedDocument(assessmentSchema, reply.value).pipe(Effect.orDie)
        )
      )
    : Option.none();
  // The open question shows what its editor holds; any other shows what the server holds,
  // and what its editor last held until the server answers.
  const doc = open
    ? Option.orElse(live, () => read)
    : Option.orElse(read, () => live);
  const choice = choiceOf(question.answers);
  const marked = markedOption(question.key) ?? "";

  return (
    <div className="absolute inset-0 overflow-hidden" ref={ref}>
      <div
        aria-hidden
        className="pointer-events-none w-4/1 origin-top-left scale-25 p-4"
        inert
      >
        <QuestionSheet number={number}>
          {Option.isSome(doc) ? (
            <QuestionSheetPrompt>
              <PreviewProse doc={doc.value} />
            </QuestionSheetPrompt>
          ) : null}
          {Option.isSome(choice) ? (
            <QuestionSheetOptions value={marked}>
              {Arr.map(choice.value.options, (option, index) => (
                <QuestionSheetOption
                  key={option.id}
                  letter={optionLetter(index)}
                  radio={<Radio value={option.id} />}
                >
                  <Input readOnly value={labelText(option.label)} />
                </QuestionSheetOption>
              ))}
            </QuestionSheetOptions>
          ) : null}
        </QuestionSheet>
      </div>
    </div>
  );
}

/**
 * A prompt drawn without an editor: the schema's own rendering of each node, which is what
 * the editor draws, with the paragraph classes the editor decorates its paragraphs with. A
 * prompt that changes while the teacher types is drawn when the browser has time.
 */
function PreviewProse({ doc }: { doc: Node }) {
  const shown = useDeferredValue(doc);

  return (
    <div
      className="wrap-break-word whitespace-pre-wrap"
      ref={(element) => {
        if (element === null) {
          return;
        }
        element.replaceChildren(
          DOMSerializer.fromSchema(shown.type.schema).serializeFragment(
            shown.content
          )
        );
        Arr.forEach(Arr.fromIterable(element.querySelectorAll("p")), (p) => {
          p.className = paragraphVariants();
        });
      }}
    />
  );
}
