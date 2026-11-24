// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type {
  ArgumentCard,
  Statement,
} from "@repo/design-system/components/contents/mathematics/argument/form";
import {
  judge,
  readChain,
} from "@repo/design-system/components/contents/mathematics/argument/form";
import { Option } from "effect";

const all = (subject: string, predicate: string): Statement => ({
  kind: "all",
  predicate,
  subject,
});
const member = (name: string, set: string): Statement => ({
  kind: "member",
  member: name,
  set,
});
const rule = (antecedent: string, consequent: string): Statement => ({
  kind: "conditional",
  antecedent,
  consequent,
});
const claim = (statement: string, negated = false): Statement => ({
  kind: "claim",
  negated,
  statement,
});
const card = (statement: Statement, truth = true): ArgumentCard => ({
  statement,
  text: statement.kind,
  truth,
});

describe("the three valid forms", () => {
  it("reads form I: all A are B, c is A, so c is B", () => {
    expect(judge(all("A", "B"), member("c", "A"), member("c", "B"))).toEqual({
      kind: "valid",
      form: "I",
    });
  });

  it("reads form II: if p then q, p, so q", () => {
    expect(judge(rule("p", "q"), claim("p"), claim("q"))).toEqual({
      kind: "valid",
      form: "II",
    });
  });

  it("reads form III: if p then q, not q, so not p", () => {
    expect(judge(rule("p", "q"), claim("q", true), claim("p", true))).toEqual({
      kind: "valid",
      form: "III",
    });
  });

  it("judges the premises in either slot, since order does not make an argument valid", () => {
    expect(judge(claim("p"), rule("p", "q"), claim("q"))).toEqual({
      kind: "valid",
      form: "II",
    });
    expect(judge(member("c", "A"), all("A", "B"), member("c", "B"))).toEqual({
      kind: "valid",
      form: "I",
    });
  });
});

describe("the fallacies", () => {
  it("names affirming the consequent: if p then q, q, so p", () => {
    expect(judge(rule("p", "q"), claim("q"), claim("p"))).toEqual({
      kind: "fallacy",
      fallacy: "consequent",
    });
  });

  it("names denying the antecedent: if p then q, not p, so not q", () => {
    expect(judge(rule("p", "q"), claim("p", true), claim("q", true))).toEqual({
      kind: "fallacy",
      fallacy: "antecedent",
    });
  });

  it("names the undistributed middle: all A are B, c is B, so c is A", () => {
    expect(judge(all("A", "B"), member("c", "B"), member("c", "A"))).toEqual({
      kind: "fallacy",
      fallacy: "middle",
    });
  });
});

describe("chains that break", () => {
  it("breaks between premises that never meet", () => {
    expect(judge(rule("p", "q"), claim("r"), claim("q")).kind).toBe("unlinked");
    expect(judge(all("A", "B"), member("c", "D"), member("c", "B")).kind).toBe(
      "unlinked"
    );
    expect(judge(all("A", "B"), claim("p"), claim("q")).kind).toBe("unlinked");
    expect(judge(rule("p", "q"), rule("q", "r"), rule("p", "r")).kind).toBe(
      "unlinked"
    );
  });

  it("breaks before a conclusion the premises do not lead to", () => {
    expect(judge(rule("p", "q"), claim("p"), claim("p")).kind).toBe(
      "unfollowed"
    );
    expect(judge(all("A", "B"), member("c", "A"), member("d", "B")).kind).toBe(
      "unfollowed"
    );
  });
});

describe("reading a chain on the rail", () => {
  const none = Option.none<ArgumentCard>();

  it("waits while a slot is empty", () => {
    const reading = readChain([none, none, none]);
    expect(reading.joints).toEqual(["pending", "pending"]);
    expect(reading.lit).toBe(false);
    expect(Option.isNone(reading.verdict)).toBe(true);
    expect(Option.isNone(reading.premisesTrue)).toBe(true);
    expect(Option.isNone(reading.sound)).toBe(true);
  });

  it("locks the premises' link once they meet, before the conclusion is in", () => {
    const reading = readChain([
      Option.some(card(rule("p", "q"))),
      Option.some(card(claim("p"))),
      none,
    ]);
    expect(reading.joints).toEqual(["locked", "pending"]);
    expect(reading.premisesTrue).toEqual(Option.some(true));
  });

  it("locks every link and lights the lamp for a sound argument", () => {
    const reading = readChain([
      Option.some(card(rule("p", "q"))),
      Option.some(card(claim("q", true))),
      Option.some(card(claim("p", true))),
    ]);
    expect(reading.joints).toEqual(["locked", "locked"]);
    expect(reading.lit).toBe(true);
    expect(reading.valid).toEqual(Option.some(true));
    expect(reading.sound).toEqual(Option.some(true));
  });

  it("keeps a valid chain locked but unsound when a premise is false", () => {
    const reading = readChain([
      Option.some(card(all("prime", "odd"), false)),
      Option.some(card(member("2", "prime"))),
      Option.some(card(member("2", "odd"), false)),
    ]);
    expect(reading.joints).toEqual(["locked", "locked"]);
    expect(reading.lit).toBe(true);
    expect(reading.premisesTrue).toEqual(Option.some(false));
    expect(reading.sound).toEqual(Option.some(false));
  });

  it("breaks a fallacy at the step into its conclusion", () => {
    const reading = readChain([
      Option.some(card(rule("p", "q"))),
      Option.some(card(claim("q"))),
      Option.some(card(claim("p"))),
    ]);
    expect(reading.joints).toEqual(["locked", "broken"]);
    expect(reading.lit).toBe(false);
    expect(reading.valid).toEqual(Option.some(false));
    expect(reading.sound).toEqual(Option.some(false));
  });

  it("breaks between premises that never meet, and leaves the next link waiting", () => {
    const reading = readChain([
      Option.some(card(rule("p", "q"))),
      Option.some(card(claim("r"))),
      Option.some(card(claim("q"))),
    ]);
    expect(reading.joints).toEqual(["broken", "pending"]);
    expect(reading.verdict).toEqual(Option.some({ kind: "unlinked" }));
  });
});
