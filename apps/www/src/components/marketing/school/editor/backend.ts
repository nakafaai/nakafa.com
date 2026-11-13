import { Ref } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StepView } from "@repo/backend/confect/editor/view";
import type { ExamView } from "@repo/backend/confect/exams/exam";
import { getFunctionName } from "convex/server";
import {
  Array as Arr,
  MutableHashMap,
  MutableRef,
  Option,
  Record as Rec,
  Schema,
} from "effect";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";

/** An exam as the wire carries it, which the editor's query decodes. */
type Exam = typeof ExamView.Encoded;

/** One question of an exam as the wire carries it. */
type Question = Exam["questions"][number];

/** The Convex name of a Confect function, as the client's calls carry it. */
const nameOf = (ref: Parameters<typeof Ref.getFunctionReference>[0]) =>
  getFunctionName(Ref.getFunctionReference(ref));

/** The arguments of a read of one document under one editor session. */
const DocumentArgs = Schema.Struct({
  clientId: Schema.String,
  documentId: Schema.String,
});

/** The arguments of a read of a document's steps after a version. */
const SinceArgs = Schema.Struct({
  clientId: Schema.String,
  documentId: Schema.String,
  version: Schema.Finite,
});

/** The arguments of a batch of steps sent for one document. */
const SubmitArgs = Schema.Struct({
  batch: Schema.String,
  documentId: Schema.String,
});

/** The JSON text of a batch, read only as far as the log needs it. */
const BatchText = Schema.fromJsonString(
  Schema.Struct({
    baseVersion: Schema.Finite,
    batch: Schema.String,
    clientId: Schema.String,
    steps: Schema.Array(Schema.Unknown),
  })
);

/** The JSON text of one step, as the log stores it. */
const StepText = Schema.fromJsonString(Schema.Unknown);

/** The arguments of a change to one question. */
const QuestionArgs = Schema.Struct({ questionId: Schema.String });

/** The arguments of a rename of the exam. */
const RenameArgs = Schema.Struct({ title: Schema.String });

/** The last batch one editor session had accepted, and the version it made. */
const ClientRecord = Schema.Struct({
  batch: Schema.String,
  version: Schema.Finite,
});

/** The empty document a new question's texts start as: one empty paragraph. */
const EMPTY_DOCUMENT = '{"type":"doc","content":[{"type":"paragraph"}]}';

/**
 * The exam's server for the School landing's editor: the exam, each document's snapshot and steps, and each
 * editor session's last batch, held in memory and answered by the Convex name of the function the editor calls.
 * Reads answer what the server would; the exam's own changes arrive through the editor's optimistic updates
 * (`replaceExam`), and a change that saves a question answers the question as it now stands. A new or copied
 * question is given ids of its own and its texts, as the server gives them. A read or a change the demo does not
 * hold answers nothing, so the editor keeps waiting or reports the failure as it would offline.
 */
export function createDemoBackend(seed: {
  readonly documents: Readonly<Record<string, string>>;
  readonly exam: Exam;
  readonly slug: string;
}) {
  const exam = MutableRef.make(seed.exam);
  const snapshots = MutableHashMap.fromIterable(Rec.toEntries(seed.documents));
  const logs = MutableHashMap.empty<
    string,
    readonly (typeof StepView.Type)[]
  >();
  const sessions = MutableHashMap.empty<string, typeof ClientRecord.Type>();
  const made = MutableRef.make(0);

  const stepsOf = (documentId: string) =>
    Option.getOrElse(MutableHashMap.get(logs, documentId), Arr.empty);
  const headOf = (documentId: string) => stepsOf(documentId).length;
  const sessionOf = (documentId: string, clientId: string) =>
    Option.getOrNull(MutableHashMap.get(sessions, `${documentId}/${clientId}`));

  /** A new id of a table, as the server makes one: unlike any id of the seed, and never a placeholder's UUID. */
  const nextId = <T extends "editorDocuments" | "examQuestions">(table: T) => {
    MutableRef.increment(made);
    return Schema.decodeUnknownSync(Id(table))(
      `demo${table}${MutableRef.get(made)}`
    );
  };

  /** A new text whose content is a copy of `source`'s, or empty without one. */
  const newDocument = (source: Option.Option<string>) => {
    const id = nextId("editorDocuments");
    MutableHashMap.set(
      snapshots,
      id,
      Option.flatMap(source, (from) =>
        MutableHashMap.get(snapshots, from)
      ).pipe(Option.getOrElse(() => EMPTY_DOCUMENT))
    );
    return id;
  };

  /** The question with an id, as the exam now holds it. */
  const questionOf = (questionId: string) =>
    Arr.findFirst(
      MutableRef.get(exam).questions,
      (question) => question.id === questionId
    );

  /** The question a change names in its arguments, as the exam holds it after the change. */
  const changedQuestion = (args: unknown) =>
    Option.flatMap(Schema.decodeUnknownOption(QuestionArgs)(args), (named) =>
      questionOf(named.questionId)
    );

  /**
   * Saves the question the editor showed as a placeholder: it takes ids of its own, and texts of its own, copied
   * from `source`'s when the change copies a question.
   */
  const saveDraft = (source: Option.Option<Question>) =>
    Option.map(
      Arr.findFirst(MutableRef.get(exam).questions, (question) =>
        isPlaceholderId(question.prompt)
      ),
      (draft) => {
        const copied = (key: "explanation" | "prompt" | "rubric") =>
          newDocument(Option.map(source, (question) => question[key]));
        const saved: Question = {
          ...draft,
          explanation: copied("explanation"),
          id: nextId("examQuestions"),
          prompt: copied("prompt"),
          rubric: copied("rubric"),
        };
        MutableRef.update(exam, (current) => ({
          ...current,
          questions: Arr.map(current.questions, (question) =>
            question.id === draft.id ? saved : question
          ),
        }));
        return saved;
      }
    );

  /** The order of the exam's questions, as a move or a removal answers it. */
  const order = () =>
    Option.some({
      questions: Arr.map(MutableRef.get(exam).questions, ({ id }) => id),
    });

  /** Takes a batch of steps on the head of its document, or names the head it missed. */
  const submit = (args: unknown) =>
    Option.flatMap(Schema.decodeUnknownOption(SubmitArgs)(args), (sent) =>
      Option.map(Schema.decodeOption(BatchText)(sent.batch), (batch) => {
        const key = `${sent.documentId}/${batch.clientId}`;
        const head = headOf(sent.documentId);
        const repeated = Option.exists(
          MutableHashMap.get(sessions, key),
          (record) => record.batch === batch.batch
        );
        if (repeated) {
          return { _tag: "Accepted" };
        }
        if (batch.baseVersion !== head) {
          return { _tag: "VersionStale", baseVersion: batch.baseVersion, head };
        }
        const steps = Arr.map(batch.steps, (step, index) => ({
          clientId: batch.clientId,
          step: Schema.encodeSync(StepText)(step),
          version: head + index + 1,
        }));
        MutableHashMap.set(
          logs,
          sent.documentId,
          Arr.appendAll(stepsOf(sent.documentId), steps)
        );
        MutableHashMap.set(sessions, key, {
          batch: batch.batch,
          version: head + steps.length,
        });
        return { _tag: "Accepted" };
      })
    );

  const queries: Readonly<
    Record<string, (args: unknown) => Option.Option<unknown>>
  > = {
    [nameOf(exams.exams.open)]: () => Option.some(MutableRef.get(exam)),
    [nameOf(exams.presence.list)]: () => Option.some([]),
    [nameOf(exams.assets.urls)]: () => Option.some([]),
    [nameOf(exams.assets.media)]: () => Option.some([]),
    [nameOf(editors.documents.open)]: (args) =>
      Option.flatMap(Schema.decodeUnknownOption(DocumentArgs)(args), (read) =>
        Option.map(
          MutableHashMap.get(snapshots, read.documentId),
          (content) => ({
            client: sessionOf(read.documentId, read.clientId),
            snapshot: { content, version: 0 },
            steps: stepsOf(read.documentId),
          })
        )
      ),
    [nameOf(editors.steps.since)]: (args) =>
      Option.map(Schema.decodeUnknownOption(SinceArgs)(args), (read) => ({
        _tag: "steps",
        client: sessionOf(read.documentId, read.clientId),
        steps: Arr.filter(
          stepsOf(read.documentId),
          (step) => step.version > read.version
        ),
      })),
  };

  const mutations: Readonly<
    Record<string, (args: unknown) => Option.Option<unknown>>
  > = {
    [nameOf(editors.steps.submit)]: submit,
    [nameOf(exams.presence.join)]: () => Option.some({ token: "demo" }),
    [nameOf(exams.presence.leave)]: () => Option.some(null),
    [nameOf(exams.exams.rename)]: (args) =>
      Option.map(Schema.decodeUnknownOption(RenameArgs)(args), ({ title }) => ({
        id: MutableRef.get(exam).id,
        title,
      })),
    [nameOf(exams.questions.add)]: () => saveDraft(Option.none()),
    [nameOf(exams.questions.copy)]: (args) => saveDraft(changedQuestion(args)),
    [nameOf(exams.questions.move)]: order,
    [nameOf(exams.questions.remove)]: order,
    [nameOf(exams.questions.points)]: changedQuestion,
    [nameOf(exams.questions.media)]: changedQuestion,
    [nameOf(exams.questions.reading)]: changedQuestion,
    [nameOf(exams.questions.scoring)]: changedQuestion,
    [nameOf(exams.questions.answer)]: changedQuestion,
    [nameOf(exams.questions.template)]: changedQuestion,
  };

  return {
    /** The arguments of the exam's read, as the editor sends them. */
    examArgs: { examId: seed.exam.id, slug: seed.slug },
    /** The name of the exam's read, whose answer the editor's optimistic updates change. */
    examQuery: nameOf(exams.exams.open),
    /** The exam as it now stands. */
    exam: () => MutableRef.get(exam),
    /** Answers a change by its function's name, or none for a change the demo does not hold. */
    mutate: (name: string, args: unknown) =>
      Option.flatMap(Rec.get(mutations, name), (change) => change(args)),
    /** Answers a read by its function's name, or none while the demo holds no answer for it. */
    query: (name: string, args: unknown) =>
      Option.flatMap(Rec.get(queries, name), (read) => read(args)),
    /** Takes the exam an optimistic update wrote, as the server's answer would bring it. */
    replaceExam: (next: Exam) => MutableRef.set(exam, next),
  };
}

/** The demo's server, as the client reads it. */
export type DemoBackend = ReturnType<typeof createDemoBackend>;
