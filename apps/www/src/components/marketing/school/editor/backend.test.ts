import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import editors from "@repo/backend/confect/_generated/refs/editor";
import exams from "@repo/backend/confect/_generated/refs/exams";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { getFunctionName } from "convex/server";
import { Array as Arr, Option, Schema } from "effect";
import { createDemoBackend } from "@/components/marketing/school/editor/backend";
import { demoExam } from "@/components/marketing/school/editor/exam";
import { isPlaceholderId } from "@/components/tenant/exams/placeholder";

/** The Convex name of a Confect function. */
const nameOf = (ref: Parameters<typeof Ref.getFunctionReference>[0]) =>
  getFunctionName(Ref.getFunctionReference(ref));

/** The JSON text of a batch or a step, as the editor's sync sends it. */
const jsonText = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** A batch of steps one editor session sends. */
const Batch = Schema.Struct({
  baseVersion: Schema.Finite,
  batch: Schema.String,
  clientId: Schema.String,
  steps: Schema.Array(Schema.Unknown),
});

/** A step the editor would send: an insertion of text at a position. */
const STEP = { from: 1, stepType: "replace", to: 1 };

/** The ids of a question the server saved, as a test reads them back. */
const SavedQuestion = Schema.Struct({
  id: Schema.String,
  prompt: Schema.String,
});

/** A placeholder id, as the editor makes one for a question the server has not saved. */
const PLACEHOLDER = "3f0e4f6a-8f1c-4d8e-9a5b-2c1d0e9f8a7b";

/** A fresh demo backend over the English demo exam. */
const makeBackend = () =>
  createDemoBackend(
    demoExam({
      answer: en.Common.answer,
      essay: en.SchoolSite["demo-exam-essay"],
      explanation: en.SchoolSite["demo-exam-explanation"],
      numeric: en.SchoolSite["demo-exam-numeric"],
      question: en.SchoolSite["demo-exam-question"],
      rubric: en.SchoolSite["demo-exam-rubric"],
      title: en.SchoolSite["demo-exam-title"],
    })
  );

/** The backend's exam with a placeholder question appended, as an add's optimistic update leaves it. */
const withDraft = (backend: ReturnType<typeof makeBackend>) => {
  const exam = backend.exam();
  const [first] = exam.questions;
  backend.replaceExam({
    ...exam,
    questions: [
      ...exam.questions,
      {
        ...first,
        explanation: Schema.decodeUnknownSync(Id("editorDocuments"))(
          PLACEHOLDER
        ),
        id: Schema.decodeUnknownSync(Id("examQuestions"))(PLACEHOLDER),
        prompt: Schema.decodeUnknownSync(Id("editorDocuments"))(PLACEHOLDER),
        rubric: Schema.decodeUnknownSync(Id("editorDocuments"))(PLACEHOLDER),
      },
    ],
  });
};

describe("the demo exam's server", () => {
  it("answers the exam, its documents, and empty presence and assets", () => {
    const backend = makeBackend();

    expect(backend.query(nameOf(exams.exams.open), {})).toEqual(
      Option.some(backend.exam())
    );
    expect(backend.query(nameOf(exams.presence.list), {})).toEqual(
      Option.some([])
    );
    expect(backend.query(nameOf(exams.assets.urls), {})).toEqual(
      Option.some([])
    );
    expect(backend.query(nameOf(exams.assets.media), {})).toEqual(
      Option.some([])
    );
    expect(
      backend.query(nameOf(editors.documents.open), {
        clientId: "preview",
        documentId: "seedprompt1",
      })
    ).toEqual(
      Option.some({
        client: null,
        snapshot: {
          content: expect.stringContaining("mathInline"),
          version: 0,
        },
        steps: [],
      })
    );
    expect(backend.examArgs).toEqual({ examId: "seedexam", slug: "demo" });
  });

  it("answers nothing for a read or a change it does not hold, or arguments it cannot read", () => {
    const backend = makeBackend();

    expect(backend.query("exams/rooms:list", {})).toEqual(Option.none());
    expect(backend.mutate("exams/exams:schedule", {})).toEqual(Option.none());
    expect(
      backend.query(nameOf(editors.documents.open), {
        clientId: "preview",
        documentId: "missing",
      })
    ).toEqual(Option.none());
    expect(backend.query(nameOf(editors.steps.since), {})).toEqual(
      Option.none()
    );
    expect(backend.mutate(nameOf(editors.steps.submit), {})).toEqual(
      Option.none()
    );
    expect(backend.mutate(nameOf(exams.exams.rename), {})).toEqual(
      Option.none()
    );
    expect(
      backend.mutate(nameOf(exams.questions.points), { questionId: "missing" })
    ).toEqual(Option.none());
  });

  it("keeps a session's steps in order, answers a repeat as accepted, and names the head a stale batch missed", () => {
    const backend = makeBackend();
    const submit = (batch: typeof Batch.Type) =>
      backend.mutate(nameOf(editors.steps.submit), {
        batch: jsonText(batch),
        documentId: "seedprompt1",
      });
    const first = {
      baseVersion: 0,
      batch: "b1",
      clientId: "c1",
      steps: [STEP, STEP],
    };

    expect(submit(first)).toEqual(Option.some({ _tag: "Accepted" }));
    expect(submit(first)).toEqual(Option.some({ _tag: "Accepted" }));
    expect(
      submit({ baseVersion: 1, batch: "b2", clientId: "c1", steps: [STEP] })
    ).toEqual(Option.some({ _tag: "VersionStale", baseVersion: 1, head: 2 }));
    expect(
      backend.query(nameOf(editors.steps.since), {
        clientId: "c1",
        documentId: "seedprompt1",
        version: 1,
      })
    ).toEqual(
      Option.some({
        _tag: "steps",
        client: { batch: "b1", version: 2 },
        steps: [{ clientId: "c1", step: jsonText(STEP), version: 2 }],
      })
    );
    expect(
      Option.map(
        backend.query(nameOf(editors.documents.open), {
          clientId: "c1",
          documentId: "seedprompt1",
        }),
        (opened) => opened
      )
    ).toEqual(
      Option.some(
        expect.objectContaining({ client: { batch: "b1", version: 2 } })
      )
    );
  });

  it("answers a rename, a move and a change of a question as the exam now holds them", () => {
    const backend = makeBackend();
    const order = Option.some({
      questions: ["seedquestion1", "seedquestion2", "seedquestion3"],
    });

    expect(
      backend.mutate(nameOf(exams.exams.rename), { title: "Biology" })
    ).toEqual(Option.some({ id: "seedexam", title: "Biology" }));
    expect(backend.mutate(nameOf(exams.questions.move), {})).toEqual(order);
    expect(backend.mutate(nameOf(exams.questions.remove), {})).toEqual(order);
    expect(
      backend.mutate(nameOf(exams.questions.points), {
        questionId: "seedquestion2",
      })
    ).toEqual(Arr.get(backend.exam().questions, 1));
    expect(backend.mutate(nameOf(exams.presence.join), {})).toEqual(
      Option.some({ token: "demo" })
    );
    expect(backend.mutate(nameOf(exams.presence.leave), {})).toEqual(
      Option.some(null)
    );
  });

  it("saves an added question with ids and empty texts of its own", () => {
    const backend = makeBackend();

    expect(backend.mutate(nameOf(exams.questions.add), {})).toEqual(
      Option.none()
    );
    withDraft(backend);
    const saved = Schema.decodeUnknownSync(SavedQuestion)(
      Option.getOrThrow(backend.mutate(nameOf(exams.questions.add), {}))
    );

    expect(Arr.map(backend.exam().questions, ({ id }) => id)).toEqual([
      "seedquestion1",
      "seedquestion2",
      "seedquestion3",
      saved.id,
    ]);
    expect(isPlaceholderId(saved.id)).toBe(false);
    expect(
      backend.query(nameOf(editors.documents.open), {
        clientId: "c1",
        documentId: saved.prompt,
      })
    ).toEqual(
      Option.some(
        expect.objectContaining({
          snapshot: {
            content: '{"type":"doc","content":[{"type":"paragraph"}]}',
            version: 0,
          },
        })
      )
    );
  });

  it("saves a copied question with copies of its source's texts", () => {
    const backend = makeBackend();
    withDraft(backend);
    const saved = Schema.decodeUnknownSync(SavedQuestion)(
      Option.getOrThrow(
        backend.mutate(nameOf(exams.questions.copy), {
          questionId: "seedquestion1",
        })
      )
    );
    const read = (documentId: string) =>
      backend.query(nameOf(editors.documents.open), {
        clientId: "c1",
        documentId,
      });

    expect(read(saved.prompt)).toEqual(read("seedprompt1"));
  });
});
