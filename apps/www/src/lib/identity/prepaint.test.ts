import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
  KEPT_ACCOUNT_SCRIPT,
  KEPT_NAME_PROPERTY,
  KEPT_PLAN_ATTRIBUTE,
} from "@/lib/identity/prepaint";

/** Writes a stored value as the browser keeps it, as JSON text. */
const toJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const KEPT = {
  mascot: "cat.0.243e66.right.open",
  name: "Siti Rahma",
  plan: "free",
  sessionId: "session-1",
};

/** Runs the script against a stored session and row, and returns what it set on the root. */
function run(stored: Record<string, string>, failing = false) {
  const attributes: Record<string, string> = {};
  const properties: Record<string, string> = {};
  const documentStub = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
      style: {
        setProperty: (name: string, value: string) => {
          properties[name] = value;
        },
      },
    },
  };
  const storageStub = {
    getItem: (key: string) => {
      if (failing) {
        throw new Error("The storage is blocked");
      }
      return stored[key] ?? null;
    },
  };
  new Function("document", "localStorage", KEPT_ACCOUNT_SCRIPT)(
    documentStub,
    storageStub
  );
  return {
    name: properties[KEPT_NAME_PROPERTY],
    plan: attributes[KEPT_PLAN_ATTRIBUTE],
  };
}

describe("kept account script", () => {
  it("names the plan and the name of the row kept for the browser's session", () => {
    expect(
      run({
        "nakafa-account": toJson(KEPT),
        "nakafa-session": "session-1",
      })
    ).toEqual({ name: '"Siti Rahma"', plan: "free" });
  });

  it("writes the name as a CSS string, quotes escaped and control characters dropped", () => {
    expect(
      run({
        "nakafa-account": toJson({
          ...KEPT,
          name: 'Siti "Rara"\n Rahma',
          plan: "pro",
        }),
        "nakafa-session": "session-1",
      })
    ).toEqual({ name: '"Siti \\"Rara\\" Rahma"', plan: "pro" });
  });

  it("leaves the row hidden for another session, no session, or no row", () => {
    const hidden = { name: undefined, plan: undefined };
    expect(
      run({
        "nakafa-account": toJson(KEPT),
        "nakafa-session": "session-2",
      })
    ).toEqual(hidden);
    expect(run({ "nakafa-account": toJson(KEPT) })).toEqual(hidden);
    expect(run({ "nakafa-session": "session-1" })).toEqual(hidden);
  });

  it("leaves the row hidden when the kept row or the storage cannot be read", () => {
    const hidden = { name: undefined, plan: undefined };
    expect(
      run({ "nakafa-account": "{not json", "nakafa-session": "session-1" })
    ).toEqual(hidden);
    expect(
      run({
        "nakafa-account": toJson({ ...KEPT, name: 7 }),
        "nakafa-session": "session-1",
      })
    ).toEqual(hidden);
    expect(run({}, true)).toEqual(hidden);
  });
});
