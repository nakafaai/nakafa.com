import { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { newChoiceAnswers } from "@repo/backend/confect/exams/question";
import { StaleAnswer } from "@repo/backend/confect/exams/sittings/errors";
import type { Wire } from "@repo/backend/scripts/load/wire";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { Array as Arr, Effect, MutableHashMap, Option, Schema } from "effect";

const sittings = refs.public.exams.sittings;

/** One call that the fake server took: the function's name and its encoded arguments. */
export interface Call {
  readonly args: Record<string, unknown>;
  readonly name: string;
}

/** A listener of one live query on the fake server. */
interface Listener {
  readonly args: Record<string, unknown>;
  readonly name: string;
  readonly onValue: (value: unknown) => void;
  open: boolean;
}

/** The questions of the fake exam, by their IDs. */
export const QUESTIONS = ["q1", "q2", "q3", "q4"];

/** The fake room's seats, which a proctor's dashboard lists. */
export const SEATS = ["a1", "a2"];

/**
 * A Convex deployment in memory that answers the sitting's functions as the real one does for
 * one student: entry admits attempt `a1` (or refuses with `refuse`), an answer is saved when its
 * version is newer and refused as stale otherwise (or always, with `stale`), and the paper is sent
 * again after every save.
 */
export const fakeServer = (
  options: { readonly refuse?: boolean; readonly stale?: boolean } = {}
) => {
  const calls: Call[] = [];
  const listeners: Listener[] = [];
  const saved = MutableHashMap.empty<
    string,
    { response: unknown; version: number }
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
            onSome: (value) =>
              Schema.decodeUnknownSync(Schema.Array(Schema.String))(
                value.response
              ),
          }),
          version: Option.match(answer, {
            onNone: () => null,
            onSome: (value) => value.version,
          }),
        };
      }),
    });
  const values: Record<string, (args: Record<string, unknown>) => unknown> = {
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
  const push = (name: string) => {
    for (const listener of listeners) {
      if (listener.open && listener.name === name) {
        listener.onValue(values[name]?.(listener.args));
      }
    }
  };
  const mutations: Record<
    string,
    (args: Record<string, unknown>) => Promise<unknown>
  > = {
    "exams/sittings:answer": (args) => {
      const question = String(args.questionId);
      const version = Number(args.version);
      const current = MutableHashMap.get(saved, question);
      if (
        options.stale === true ||
        Option.exists(current, (value) => value.version >= version)
      ) {
        return Promise.reject(
          new ConvexError(Schema.encodeSync(StaleAnswer)(new StaleAnswer()))
        );
      }
      MutableHashMap.set(saved, question, { response: args.response, version });
      push("exams/sittings:paper");
      return Promise.resolve(null);
    },
    "exams/sittings:enter": () =>
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
      ),
  };
  const wire: Wire = {
    close: () => Promise.resolve(),
    mutation: (reference, args) => {
      const name = getFunctionName(reference);
      calls.push({ args, name });
      return mutations[name]?.(args) ?? Promise.resolve(null);
    },
    onUpdate: (reference, args, onValue) => {
      const listener: Listener = {
        args,
        name: getFunctionName(reference),
        onValue,
        open: true,
      };
      listeners.push(listener);
      onValue(values[listener.name]?.(args));
      return () => {
        listener.open = false;
      };
    },
  };
  return {
    calls,
    listeners,
    open: Effect.succeed(wire),
    push,
    saved,
    wire,
  };
};

/** The fake sitting, as the student's view and the dashboard show it. */
const sittingView = {
  closesAt: 1,
  cohortId: null,
  examId: "e1",
  examTitle: "Ujian Beban",
  id: "s1",
  opensAt: 0,
  room: "Ruang 01",
  state: "open" as const,
  timeZone: "Asia/Jakarta",
  unitId: "u1",
};
