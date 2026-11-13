import { describe, expect, it } from "@effect/vitest";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { makeFunctionReference } from "convex/server";
import { Effect, MutableRef } from "effect";
import { createDemoBackend } from "@/components/marketing/school/demo/backend";
import {
  DemoConvexClient,
  DemoUnavailable,
} from "@/components/marketing/school/demo/client";
import { demoExam } from "@/components/marketing/school/demo/exam";

/** The exam's read, by the name the editor's hooks call it. */
const OPEN = makeFunctionReference<"query">("exams/exams:open");

/** A read of one document, as the editor's sync opens it. */
const DOCUMENT = makeFunctionReference<"query">("editor/documents:open");

/** A read the demo does not hold. */
const ROOMS = makeFunctionReference<"query">("exams/rooms:list");

/** A change of one question's points, which the demo answers with the question. */
const POINTS = makeFunctionReference<"mutation">("exams/questions:points");

/** A change the demo does not hold. */
const SCHEDULE = makeFunctionReference<"mutation">("exams/exams:schedule");

/** An action, which the demo never runs. */
const REGISTER = makeFunctionReference<"action">("exams/assets:register");

/** A fresh demo client over the English demo exam, with its backend. */
const makeClient = () => {
  const backend = createDemoBackend(
    demoExam({
      answer: en.SchoolSite["demo-exam-answer"],
      essay: en.SchoolSite["demo-exam-essay"],
      explanation: en.SchoolSite["demo-exam-explanation"],
      numeric: en.SchoolSite["demo-exam-numeric"],
      question: en.SchoolSite["demo-exam-question"],
      rubric: en.SchoolSite["demo-exam-rubric"],
      title: en.SchoolSite["demo-exam-title"],
    })
  );
  return { backend, client: new DemoConvexClient(backend) };
};

describe("the demo's Convex client", () => {
  it("answers a watch from the demo with the same value until something changes", () => {
    const { backend, client } = makeClient();
    const watch = client.watchQuery(OPEN, backend.examArgs);

    expect(watch.localQueryResult()).toBe(backend.exam());
    expect(watch.localQueryResult()).toBe(watch.localQueryResult());
    expect(watch.journal()).toBeUndefined();
    expect(client.watchQuery(ROOMS).localQueryResult()).toBeUndefined();
  });

  it.effect("answers a read once, or fails one the demo does not hold", () =>
    Effect.gen(function* () {
      const { client } = makeClient();

      const opened = yield* Effect.promise(() =>
        client.query(DOCUMENT, {
          clientId: "preview",
          documentId: "seedprompt1",
        })
      );
      const refused = yield* Effect.promise(() =>
        client.query(ROOMS).catch((error: unknown) => error)
      );

      expect(opened).toEqual(expect.objectContaining({ steps: [] }));
      expect(refused).toEqual(
        new DemoUnavailable({ call: "exams/rooms:list" })
      );
    })
  );

  it.effect(
    "runs a change's optimistic update on the demo's exam, tells every watch, and answers the change",
    () =>
      Effect.gen(function* () {
        const { backend, client } = makeClient();
        const updates = MutableRef.make(0);
        const stop = client
          .watchQuery(OPEN, backend.examArgs)
          .onUpdate(() => MutableRef.increment(updates));
        const before = backend.exam();

        const saved = yield* Effect.promise(() =>
          client.mutation(
            POINTS,
            { questionId: "seedquestion1" },
            {
              optimisticUpdate: (store) => {
                const [entry] = store.getAllQueries(OPEN);
                store.setQuery(ROOMS, {}, []);
                store.setQuery(OPEN, backend.examArgs, "not an exam");
                store.setQuery(OPEN, backend.examArgs, {
                  ...store.getQuery(OPEN, backend.examArgs),
                  title: "Biology",
                });
                expect(store.getAllQueries(ROOMS)).toEqual([]);
                expect(entry?.value).toBe(before);
              },
            }
          )
        );
        stop();
        yield* Effect.promise(() =>
          client.mutation(POINTS, { questionId: "seedquestion2" })
        );

        expect(backend.exam().title).toBe("Biology");
        expect(saved).toEqual(expect.objectContaining({ id: "seedquestion1" }));
        expect(MutableRef.get(updates)).toBe(2);
      })
  );

  it.effect("fails a change or an action the demo does not hold", () =>
    Effect.gen(function* () {
      const { client } = makeClient();
      const fail = (run: () => Promise<unknown>) =>
        Effect.promise(() => run().catch((error: unknown) => error));

      expect(yield* fail(() => client.mutation(SCHEDULE))).toEqual(
        new DemoUnavailable({ call: "exams/exams:schedule" })
      );
      expect(yield* fail(() => client.action(REGISTER))).toEqual(
        new DemoUnavailable({ call: "exams/assets:register" })
      );
    })
  );
});
