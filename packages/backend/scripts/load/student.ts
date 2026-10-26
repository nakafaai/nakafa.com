import refs from "@repo/backend/confect/_generated/refs";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { Step, StudentScript } from "@repo/backend/scripts/load/plan";
import { Recorder, timed } from "@repo/backend/scripts/load/recorder";
import { send, type Wire, watch } from "@repo/backend/scripts/load/wire";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Clock,
  Deferred,
  Duration,
  Effect,
  MutableHashMap,
  Option,
  Random,
  Schema,
  type Scope,
} from "effect";

const sittings = refs.public.exams.sittings;
const { look } = refs.public.exams.screens;

/** A student whose entry the sitting refused, with the reason it gave. */
export class EntryRefused extends Schema.TaggedError<EntryRefused>()(
  "EntryRefused",
  { reason: Schema.String }
) {}

/** Where one student sits: the school, the room's sitting, and the room's token. */
export const Seating = Schema.Struct({
  sittingId: Id("examSittings"),
  slug: TenantSlug,
  token: Schema.String,
});

/** How many options each question of the load test's exam offers. */
const OPTIONS = 4;

/** The version of each question's answer that this student has seen last, by the question's ID. */
type Versions = MutableHashMap.MutableHashMap<string, number>;

/**
 * One student of a run: the script it follows, its seat, and `open`, which opens one
 * browser tab's connection for as long as its scope lasts. `start` is when the run began.
 */
export interface StudentInput {
  readonly open: Effect.Effect<Wire, never, Scope.Scope>;
  readonly script: StudentScript;
  readonly seating: typeof Seating.Type;
  readonly start: number;
}

/** One open tab of the player: its connection, its device, its attempt, and the paper's questions. */
interface Tab {
  readonly attempt: string;
  readonly deviceId: string;
  readonly questions: readonly (typeof Id.Type)[];
  readonly wire: Wire;
}

/** Waits until the clock reads `at`, or not at all once it has passed. */
const sleepUntil = Effect.fn("load.student.sleep")(function* (at: number) {
  const now = yield* Clock.currentTimeMillis;
  yield* Effect.sleep(Duration.millis(Math.max(0, at - now)));
});

/** Keeps the newest version of each question that the paper says the server saved. */
const keepSaved =
  (versions: Versions) =>
  (paper: {
    readonly questions: readonly {
      readonly id: string;
      readonly version: number | null;
    }[];
  }) => {
    for (const question of paper.questions) {
      const seen = Option.getOrElse(
        MutableHashMap.get(versions, question.id),
        () => 0
      );
      MutableHashMap.set(
        versions,
        question.id,
        Math.max(seen, question.version ?? 0)
      );
    }
  };

/**
 * Opens one tab of the player as a student's browser does: the connection, the student's view of
 * the sitting, the entry with the room's token from this device, and the paper, which stays live
 * for the tab's scope so every saved answer comes back through it.
 */
const openTab = Effect.fn("load.student.tab")(function* (
  input: StudentInput,
  deviceId: string,
  versions: Versions
) {
  const { sittingId, slug, token } = input.seating;
  const wire = yield* input.open;
  const view = yield* watch(
    wire,
    sittings.student,
    { sittingId, slug },
    () => undefined
  );
  yield* timed("query:student", Deferred.await(view));
  const entered = yield* timed(
    "mutation:enter",
    send(wire, sittings.enter, { deviceId, sittingId, slug, token })
  );
  if (entered.outcome === "refused") {
    return yield* new EntryRefused({ reason: entered.reason });
  }
  const sheet = yield* watch(
    wire,
    sittings.paper,
    { deviceId, sittingId, slug },
    keepSaved(versions)
  );
  const paper = yield* timed("query:paper", Deferred.await(sheet));
  return {
    attempt: entered.attempt,
    deviceId,
    questions: Arr.map(paper.questions, (question) => question.id),
    wire,
  } satisfies Tab;
});

/**
 * Saves one answer with its version, as the player sends it, and records the answer as
 * acknowledged once the server took it. A refusal is recorded with the answer's timing.
 */
const write = Effect.fn("load.student.write")(function* (
  input: StudentInput,
  tab: Tab,
  answer: {
    readonly question: string;
    readonly response: readonly string[];
    readonly version: number;
  }
) {
  const recorder = yield* Recorder;
  const { sittingId, slug } = input.seating;
  const sent = yield* timed(
    "mutation:answer",
    send(tab.wire, sittings.answer, {
      deviceId: tab.deviceId,
      questionId: answer.question,
      response: answer.response,
      sittingId,
      slug,
      version: answer.version,
    })
  ).pipe(Effect.result);
  if (sent._tag === "Success") {
    yield* recorder.acknowledge({ attempt: tab.attempt, ...answer });
  }
});

/** Chooses an option for a question and numbers it one above the newest version this student has seen. */
const choose = Effect.fn("load.student.choose")(function* (
  versions: Versions,
  question: string
) {
  const option = yield* Random.nextIntBetween(1, OPTIONS);
  // The paper numbers every question as it arrives, before the student answers any.
  const seen = yield* Effect.fromOption(
    MutableHashMap.get(versions, question)
  ).pipe(Effect.orDie);
  const version = seen + 1;
  MutableHashMap.set(versions, question, version);
  return { question, response: [`option-${option}`], version };
});

/**
 * Takes one step of the script on an open tab: the question's prompt and the proctor's view of
 * the student's screen move to it, and the student saves an answer. The prompt and the view
 * are recorded with their timings, and a failure of either does not stop the student.
 */
const takeStep = Effect.fn("load.student.step")(function* (
  input: StudentInput,
  tab: Tab,
  versions: Versions,
  step: Step
) {
  // The plan and the seeded exam hold the same number of questions, so every step names one.
  const question = yield* Effect.fromOption(
    Arr.get(tab.questions, step.question)
  ).pipe(Effect.orDie);
  const { sittingId, slug } = input.seating;
  yield* Effect.scoped(
    Effect.flatMap(
      watch(
        tab.wire,
        sittings.prompt,
        { deviceId: tab.deviceId, questionId: question, sittingId, slug },
        () => undefined
      ),
      (shown) => timed("query:prompt", Deferred.await(shown))
    )
  ).pipe(Effect.result);
  yield* timed(
    "mutation:look",
    send(tab.wire, look, {
      attemptId: tab.attempt,
      deviceId: tab.deviceId,
      questionId: question,
      slug,
    })
  ).pipe(Effect.result);
  yield* write(input, tab, yield* choose(versions, question));
});

/**
 * The second tab of a student who opens one (K26): the tab enters from the same device, which
 * the player keeps in the browser, sends the second tab's integrity signal, and changes the
 * first answer of the paper, numbered from the paper it reads, as a second tab of the player
 * does. It closes once that answer is saved.
 */
const secondTab = Effect.fn("load.student.secondTab")(function* (
  input: StudentInput,
  deviceId: string,
  versions: Versions
) {
  const tab = yield* openTab(input, deviceId, versions);
  const { slug } = input.seating;
  yield* timed(
    "mutation:signal",
    send(tab.wire, sittings.signal, {
      attemptId: tab.attempt,
      deviceId,
      kind: "secondTab",
      slug,
    })
  ).pipe(Effect.result);
  const first = yield* Effect.fromOption(Arr.head(tab.questions)).pipe(
    Effect.orDie
  );
  yield* write(input, tab, yield* choose(versions, first));
}, Effect.scoped);

/** Takes the steps on an open tab, each at its time after the student's entry. */
const takeSteps = Effect.fn("load.student.steps")(function* (
  input: StudentInput,
  tab: Tab,
  versions: Versions,
  entry: { readonly at: number; readonly steps: readonly Step[] }
) {
  yield* Effect.forEach(
    entry.steps,
    (step) =>
      Effect.andThen(
        sleepUntil(entry.at + step.at),
        takeStep(input, tab, versions, step)
      ),
    { discard: true }
  );
});

/** Finishes the attempt from an open tab, as the student's Finish button does. */
const finishOn = Effect.fn("load.student.finish")(function* (
  input: StudentInput,
  tab: Tab
) {
  const { sittingId, slug } = input.seating;
  yield* timed(
    "mutation:finish",
    send(tab.wire, sittings.finish, { deviceId: tab.deviceId, sittingId, slug })
  ).pipe(Effect.result);
});

/**
 * Runs one student through a sitting (K26). The student enters at the script's time and takes
 * every step on one tab, with a second tab beside it halfway when the script opens one. A
 * student with a cut loses the connection after the cut's step: the answers chosen while it
 * is away wait in the browser with their versions, and once it is back a new tab enters from
 * the same device and sends them in order, which the run records as the resync. The student
 * finishes the attempt after the last step.
 */
export const runStudent = Effect.fn("load.student")(function* (
  input: StudentInput
) {
  const { cut, enterAt, secondTab: opensSecond, steps } = input.script;
  const versions: Versions = MutableHashMap.empty();
  const deviceId = yield* randomUuid;
  yield* sleepUntil(input.start + enterAt);
  const entered = yield* Clock.currentTimeMillis;
  const online = cut === null ? steps : Arr.take(steps, cut.afterStep + 1);
  const questions = yield* Effect.scoped(
    Effect.gen(function* () {
      const tab = yield* openTab(input, deviceId, versions);
      if (opensSecond) {
        const halfway = Option.match(
          Arr.get(steps, Math.floor(steps.length / 2)),
          { onNone: () => 0, onSome: (step) => step.at }
        );
        yield* Effect.forkScoped(
          Effect.andThen(
            sleepUntil(entered + halfway),
            secondTab(input, deviceId, versions)
          ).pipe(Effect.result)
        );
      }
      yield* takeSteps(input, tab, versions, { at: entered, steps: online });
      if (cut === null) {
        yield* finishOn(input, tab);
      }
      return tab.questions;
    })
  );
  if (cut === null) {
    return;
  }
  const back = (yield* Clock.currentTimeMillis) + cut.lasts;
  const after = Arr.drop(steps, cut.afterStep + 1);
  const away = Arr.takeWhile(after, (step) => entered + step.at < back);
  // While the connection is away the student keeps answering, and the browser keeps each answer.
  const kept = yield* Effect.forEach(away, (step) =>
    Effect.andThen(
      sleepUntil(entered + step.at),
      Effect.fromOption(Arr.get(questions, step.question)).pipe(
        Effect.orDie,
        Effect.flatMap((question) => choose(versions, question))
      )
    )
  );
  yield* sleepUntil(back);
  yield* Effect.scoped(
    Effect.gen(function* () {
      // The resync runs from the reconnection to the last kept answer the server took.
      const tab = yield* timed(
        "sync:reconnect",
        Effect.tap(openTab(input, deviceId, versions), (reopened) =>
          Effect.forEach(kept, (answer) => write(input, reopened, answer), {
            discard: true,
          })
        )
      );
      yield* takeSteps(input, tab, versions, {
        at: entered,
        steps: Arr.drop(after, away.length),
      });
      yield* finishOn(input, tab);
    })
  );
});
