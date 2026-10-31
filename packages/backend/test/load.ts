import { Ref } from "@confect/core";
import { Id, type TableNames } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { newChoiceAnswers } from "@repo/backend/confect/exams/question";
import { StaleAnswer } from "@repo/backend/confect/exams/sittings/errors";
import type { Wire } from "@repo/backend/scripts/load/wire";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  MutableList,
  Option,
  Schema,
} from "effect";

const sittings = refs.public.exams.sittings;

/** A test ID of one table, as the server's rows carry it. */
export const idOf = <const TableName extends TableNames>(
  table: TableName,
  value: string
) => Schema.decodeUnknownSync(Id(table))(value);

/** One call that the fake server took: the function's name and its encoded arguments. */
const Call = Schema.Struct({
  args: Schema.Record(Schema.String, Schema.Unknown),
  name: Schema.String,
});

/** A listener of one live query on the fake server, open until the client lets it go. */
interface Listener {
  readonly args: Record<string, unknown>;
  readonly name: string;
  readonly onValue: (value: unknown) => void;
  open: boolean;
}

/** The questions of the fake exam, by their IDs. */
const QUESTIONS = Arr.map(["q1", "q2", "q3", "q4"], (id) =>
  idOf("examQuestions", id)
);

/** The fake room's seats, which a proctor's dashboard lists. */
export const SEATS = Arr.map(["a1", "a2"], (id) => idOf("examAttempts", id));

/** The refusal of an answer whose version is not newer than the saved one. */
const stale = new ConvexError(
  Schema.encodeSync(StaleAnswer)(new StaleAnswer())
);

/** The fake sitting, as the student's view and the dashboard show it. */
const sittingView = {
  closesAt: 1,
  cohortId: null,
  examId: idOf("exams", "e1"),
  examTitle: "Ujian Beban",
  id: idOf("examSittings", "s1"),
  opensAt: 0,
  room: "Ruang 01",
  state: "open" as const,
  timeZone: "Asia/Jakarta",
  unitId: idOf("tenantUnits", "u1"),
};

/**
 * A Convex deployment in memory that answers the sitting's functions as the real one does for
 * one student: entry admits attempt `a1` (or refuses with `refuse`), an answer is saved when its
 * version is newer and refused as stale otherwise (or always, with `stale`), and the paper is sent
 * again after every save.
 */
export const fakeServer = (
  options: { readonly refuse?: boolean; readonly stale?: boolean } = {}
) => {
  const calls = MutableList.make<typeof Call.Type>();
  const listeners = MutableList.make<Listener>();
  const saved = MutableHashMap.empty<
    string,
    { readonly response: readonly string[]; readonly version: number }
  >();
  const paper = () =>
    Ref.encodeReturnsSync(sittings.paper, {
      questions: Arr.map(QUESTIONS, (id, index) => {
        const answer = MutableHashMap.get(saved, id);
        return {
          flagged: false,
          id,
          interactions: newChoiceAnswers(),
          number: index + 1,
          response: Option.match(answer, {
            onNone: () => null,
            onSome: (value) => value.response,
          }),
          version: Option.match(answer, {
            onNone: () => null,
            onSome: (value) => value.version,
          }),
        };
      }),
    });
  const values: Record<string, () => unknown> = {
    "exams/sittings:dashboard": () =>
      Ref.encodeReturnsSync(sittings.dashboard, {
        attempts: {
          continueCursor: "end",
          isDone: true,
          page: Arr.map(SEATS, (id) => ({
            away: false,
            deadline: 1,
            id,
            lastActiveAt: 0,
            latestSignal: null,
            mascot: null,
            name: "Siswa",
            state: "inProgress" as const,
          })),
        },
        can: [],
        canViewResults: false,
        sitting: sittingView,
        token: null,
      }),
    "exams/sittings:lastAnswer": () => null,
    "exams/sittings:paper": paper,
    "exams/sittings:prompt": () => ({ prompt: "{}" }),
    "exams/sittings:student": () =>
      Ref.encodeReturnsSync(sittings.student, {
        attempt: null,
        sitting: sittingView,
      }),
  };
  /** Sends the query's value again to every open listener of it, as Convex does after a write. */
  const push = (name: string) =>
    Arr.forEach(MutableList.toArray(listeners), (listener) => {
      if (listener.open && listener.name === name) {
        listener.onValue(values[name]?.());
      }
    });
  const answer = (args: Record<string, unknown>) => {
    const question = String(args.questionId);
    const version = Number(args.version);
    if (
      options.stale === true ||
      Option.exists(
        MutableHashMap.get(saved, question),
        (value) => value.version >= version
      )
    ) {
      return Promise.reject(stale);
    }
    MutableHashMap.set(saved, question, {
      response: Schema.decodeUnknownSync(Schema.Array(Schema.String))(
        args.response
      ),
      version,
    });
    push("exams/sittings:paper");
    return Promise.resolve(null);
  };
  const enter = () =>
    Promise.resolve(
      options.refuse === true
        ? { outcome: "refused", reason: "TokenRefused" }
        : {
            attempt: "a1",
            deadline: 1,
            outcome: "admitted",
            serverNow: 0,
            state: "inProgress",
          }
    );
  const wire: Wire = {
    close: () => Promise.resolve(),
    mutation: (reference, args) => {
      const name = getFunctionName(reference);
      MutableList.append(calls, { args, name });
      if (name === "exams/sittings:answer") {
        return answer(args);
      }
      return name === "exams/sittings:enter" ? enter() : Promise.resolve(null);
    },
    onUpdate: (reference, args, onValue) => {
      const listener: Listener = {
        args,
        name: getFunctionName(reference),
        onValue,
        open: true,
      };
      MutableList.append(listeners, listener);
      onValue(values[listener.name]?.());
      return () => {
        listener.open = false;
      };
    },
  };
  return {
    /** The calls the server took so far, in order. */
    calls: () => MutableList.toArray(calls),
    /** The live queries opened so far, in order, open or let go. */
    listeners: () => MutableList.toArray(listeners),
    open: Effect.succeed(wire),
    push,
    saved,
  };
};
