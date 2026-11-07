import { describe, expect, it } from "@effect/vitest";
import { entries } from "@repo/backend/confect/access/catalog";
import { decide } from "@repo/backend/confect/access/decision";
import type { Rule } from "@repo/backend/confect/access/schema";
import { principal, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, HashMap, Record } from "effect";

/**
 * The seven people of a school the matrix walks: the role each one's grant holds over the whole
 * school, and the relations each one holds on the class, its cohort, and its grades.
 */
const PERSONAS = [
  { name: "owner", relations: [], role: "owner" },
  { name: "admin", relations: [], role: "admin" },
  { name: "teacher", relations: ["subjectTeacher"], role: "teacher" },
  { name: "homeroom", relations: ["homeroom"], role: "teacher" },
  { name: "proctor", relations: [], role: "proctor" },
  { name: "student", relations: ["classMember"], role: "student" },
  {
    name: "parent",
    relations: ["guardian", "verifiedParent"],
    role: "guardian",
  },
] as const;

/** Every action of the catalog with its rule and the kind it is ruled on. */
const ACTIONS = Arr.flatMap(entries, (entry) =>
  Arr.map(Record.toEntries<string, Rule>(entry.actions), ([action, rule]) => ({
    action,
    kind: entry.kind,
    rule,
  }))
);

/** Every relation some rule names, so a decision finds each one it asks. */
const RELATIONS = Arr.dedupe(
  Arr.flatMap(ACTIONS, ({ rule }) => rule.relations)
);

/** The kinds a class page acts on: the class, its grades, and its cohort's report cards. */
const CLASS_KINDS = ["class", "grade", "report"];

/**
 * Decides every action of the catalog for every persona on one open subject of the school, and
 * answers each action with the personas it allows.
 */
const walkMatrix = Effect.gen(function* () {
  const fixture = yield* tenancyFixture;
  return yield* fixture.run(
    Effect.gen(function* () {
      const base = yield* principal(fixture.people.teacher.personId);
      const subject = {
        locked: false,
        tenantId: fixture.tenants.nf,
        units: [],
      };
      const allowed = yield* Effect.forEach(ACTIONS, ({ action, rule }) =>
        Effect.filter(PERSONAS, (persona) =>
          decide(
            action,
            rule,
            subject,
            {
              ...base,
              grants: Arr.map(Arr.take(base.grants, 1), (grant) => ({
                ...grant,
                role: { key: persona.role, kind: "builtin" as const },
                scope: { kind: "tenant" as const },
              })),
            },
            HashMap.fromIterable(
              Arr.map(RELATIONS, (relation) => [
                relation,
                Effect.succeed(Arr.contains(persona.relations, relation)),
              ])
            )
          ).pipe(Effect.map((decision) => decision === "allow"))
        ).pipe(
          Effect.map((personas) => ({
            action,
            personas: Arr.map(personas, (persona) => persona.name),
          }))
        )
      );
      return allowed;
    })
  );
});

describe("classroom/kinds", () => {
  it.effect(
    "lets an Owner do every action of the school but a person's own acts",
    () =>
      Effect.gen(function* () {
        const matrix = yield* walkMatrix;
        expect(
          Arr.map(
            Arr.filter(matrix, (row) => !Arr.contains(row.personas, "owner")),
            (row) => row.action
          ).sort()
        ).toEqual([
          "guardian.child",
          "guardian.confirm",
          "guardian.request",
          "guardian.withdraw",
          "task.submit",
        ]);
      })
  );

  it.effect("walks every class capability against every role", () =>
    Effect.gen(function* () {
      const matrix = yield* walkMatrix;
      const shown = Arr.filter(matrix, (row) =>
        Arr.some(
          ACTIONS,
          (entry) =>
            entry.action === row.action && Arr.contains(CLASS_KINDS, entry.kind)
        )
      );
      // The Proctor and the parent hold nothing in a class: the Proctor watches rooms, a parent reads a child's own pages.
      expect(
        Record.fromEntries(Arr.map(shown, (row) => [row.action, row.personas]))
      ).toEqual({
        "class.manage": ["owner", "admin"],
        "class.view": ["owner", "admin", "teacher", "student"],
        "forum.manage": ["owner", "admin", "teacher"],
        "forum.post": ["owner", "teacher", "student"],
        "forum.read": ["owner", "admin", "teacher", "student"],
        "grade.enter": ["owner", "teacher"],
        "grade.export": ["owner"],
        "grade.import": ["owner"],
        "grade.list": ["owner", "teacher"],
        "grade.release": ["owner", "teacher"],
        "grade.view": ["owner", "teacher", "student"],
        "insight.teach": ["owner", "teacher"],
        "insight.view": ["owner", "admin", "teacher"],
        "library.manage": ["owner", "teacher"],
        "post.publish": ["owner", "teacher"],
        "report.approve": ["owner"],
        "report.complete": ["owner", "homeroom"],
        "report.view": ["owner", "admin", "homeroom"],
        "task.manage": ["owner", "teacher"],
        "task.submit": ["student"],
      });
    })
  );
});
