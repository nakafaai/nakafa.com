import { isJsonContentType } from "@repo/utilities/mime";
import { describe, expect, it } from "vitest";

describe("JSON content type", () => {
  it.each([
    "application/json",
    "APPLICATION/JSON",
    "application/json;charset=utf-8",
    "application/json; charset=UTF-8",
    " Application/JSON ; charset=utf-8 ",
  ])("accepts %s", (value) => {
    expect(isJsonContentType(value)).toBe(true);
  });

  it.each([
    null,
    "",
    "application/json-seq",
    "application/json; charset=iso-8859-1",
    'application/json; charset="utf-8"',
    "application/json; charset=utf-8; version=1",
    "\napplication/json",
    "application/json\r\n",
    "text/plain",
  ])("rejects %s", (value) => {
    expect(isJsonContentType(value)).toBe(false);
  });
});
