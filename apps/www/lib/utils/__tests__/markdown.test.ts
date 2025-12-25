import type { ReactNode } from "react";
import { createElement, Fragment } from "react";
import { describe, expect, it } from "vitest";
import { filterWhitespaceNodes } from "../markdown";

describe("filterWhitespaceNodes", () => {
  describe("filters whitespace text nodes", () => {
    it("filters out empty string", () => {
      const children = ["hello", "", "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });

    it("filters out single space", () => {
      const children = ["hello", " ", "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });

    it("filters out multiple spaces", () => {
      const children = ["hello", "  ", "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });

    it("filters out tabs", () => {
      const children = ["hello", "\t", "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });

    it("filters out newlines", () => {
      const children = ["hello", "\n", "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });

    it("filters out mixed whitespace", () => {
      const children = ["hello", " \t\n ", "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });

    it("filters out multiple consecutive whitespace nodes", () => {
      const children = ["hello", " ", " ", " ", "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });
  });

  describe("preserves non-whitespace text", () => {
    it("preserves single character", () => {
      const children = ["a"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["a"]);
    });

    it("preserves single word", () => {
      const children = ["hello"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello"]);
    });

    it("preserves text with leading space", () => {
      const children = [" hello"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([" hello"]);
    });

    it("preserves text with trailing space", () => {
      const children = ["hello "];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello "]);
    });

    it("preserves text with internal spaces", () => {
      const children = ["hello world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello world"]);
    });

    it("preserves text with internal tabs", () => {
      const children = ["hello\tworld"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello\tworld"]);
    });

    it("preserves text with mixed internal whitespace", () => {
      const children = ["hello \t world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello \t world"]);
    });
  });

  describe("handles empty children", () => {
    it("returns empty array for no children", () => {
      const children: ReactNode[] = [];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([]);
    });

    it("returns empty array for only whitespace", () => {
      const children = [" ", "\t", "\n"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([]);
    });

    it("returns empty array for empty strings", () => {
      const children = ["", "", ""];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([]);
    });
  });

  describe("handles React elements", () => {
    it("preserves React elements", () => {
      const element = createElement("div", null, "content");
      const children = ["hello", element, "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("hello");
      expect(result[1]).toHaveProperty("type", "div");
      expect(result[2]).toBe("world");
    });

    it("preserves multiple React elements", () => {
      const element1 = createElement("div", null, "content1");
      const element2 = createElement("div", null, "content2");
      const children = [element1, element2];
      const result = filterWhitespaceNodes(children);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("type", "div");
      expect(result[1]).toHaveProperty("type", "div");
    });

    it("filters whitespace around React elements", () => {
      const element = createElement("div", null, "content");
      const children = [" ", element, "\t"];
      const result = filterWhitespaceNodes(children);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("type", "div");
    });

    it("preserves fragments", () => {
      const fragment1 = createElement(Fragment, null, "fragment content");
      const fragment2 = createElement(Fragment, null, "nested fragment");
      const children = [fragment1, "hello", fragment2];
      const result = filterWhitespaceNodes(children);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("type", Symbol.for("react.fragment"));
      expect(result[1]).toBe("hello");
      expect(result[2]).toHaveProperty("type", Symbol.for("react.fragment"));
    });
  });

  describe("handles mixed content types", () => {
    it("preserves mixed text and elements", () => {
      const element = createElement("div", null, "content");
      const children = ["hello", " ", element, "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("hello");
      expect(result[1]).toHaveProperty("type", "div");
      expect(result[2]).toBe("world");
    });

    it("handles number children", () => {
      const children = [123, " ", 456];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([123, 456]);
    });

    it("React Children.toArray automatically filters booleans", () => {
      const children = [true, false, "hello"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello"]);
    });

    it("React Children.toArray automatically filters null and undefined", () => {
      const children = [null, undefined, "hello"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello"]);
    });

    it("handles zero as valid child", () => {
      const children = [0, "hello", 0];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([0, "hello", 0]);
    });
  });

  describe("handles complex scenarios", () => {
    it("filters deeply nested whitespace", () => {
      const children = ["  ", "hello", "\t\n", "world", "  "];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });

    it("handles only non-whitespace text", () => {
      const children = ["hello", "world", "test"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world", "test"]);
    });

    it("handles alternating whitespace and content", () => {
      const children = [" ", "hello", " ", "world", " "];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "world"]);
    });

    it("preserves zero-width spaces", () => {
      const children = ["hello\u200Bworld"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello\u200Bworld"]);
    });

    it("preserves non-breaking spaces", () => {
      const children = ["hello\u00A0world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello\u00A0world"]);
    });
  });

  describe("handles special string cases", () => {
    it("preserves zero-width space characters", () => {
      const children = ["\u200B"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["\u200B"]);
    });

    it("preserves emojis", () => {
      const children = ["hello", " ", "👋", "world"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello", "👋", "world"]);
    });

    it("preserves special characters", () => {
      const children = ["hello!", "@#$%", "world?"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello!", "@#$%", "world?"]);
    });

    it("preserves numbers as strings", () => {
      const children = ["123", " ", "456"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["123", "456"]);
    });
  });

  describe("edge cases", () => {
    it("handles single whitespace node", () => {
      const children = [" "];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([]);
    });

    it("handles single non-whitespace node", () => {
      const children = ["hello"];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual(["hello"]);
    });

    it("handles single empty string", () => {
      const children = [""];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([]);
    });

    it("handles very long whitespace string", () => {
      const children = [" ".repeat(1000)];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([]);
    });

    it("handles very long non-whitespace string", () => {
      const longText = "a".repeat(1000);
      const children = [longText];
      const result = filterWhitespaceNodes(children);
      expect(result).toEqual([longText]);
    });
  });
});
