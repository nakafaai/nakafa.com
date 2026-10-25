import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  appendStaticCalls,
  readStaticCalls,
  readStaticFile,
  type StaticCall,
  staticDataPath,
  toStaticFile,
} from "@/lib/static/calls";

const PAGE = "<!doctype html><html><body><h1>Pecahan</h1></body></html>";

/** Calls whose inputs hold text that would close an HTML comment if written raw. */
const CALLS: readonly StaticCall[] = [
  {
    data: { locale: "id", namespaces: ["Common"] },
    key: "a1",
    url: "/_serverFn/messages",
  },
  { data: { note: "--> <!--" }, key: "b2", url: "/_serverFn/material" },
];

describe("lib/static/calls", () => {
  it("closes a page with its calls and reads them back with the page as it was", () => {
    const read = Option.getOrThrow(
      readStaticCalls(appendStaticCalls(PAGE, CALLS))
    );

    expect(read.html).toBe(PAGE);
    expect(read.calls).toEqual(CALLS);
  });

  it("reads a page without a closing comment, or with a broken one, as none", () => {
    expect(Option.isNone(readStaticCalls(PAGE))).toBe(true);
    expect(
      Option.isNone(readStaticCalls(`${PAGE}<!--nakafa-static:%%%-->`))
    ).toBe(true);
    expect(
      Option.isNone(readStaticCalls(`${PAGE}<!--nakafa-static:e30-->`))
    ).toBe(true);
  });

  it("names each answer's file under the data folder with an extension", () => {
    expect(staticDataPath("a1")).toBe("/_data/a1.bin");
  });

  it("keeps an answer's content type and its bytes in one file", () => {
    const body = new Uint8Array([0, 10, 255, 1]);
    const read = Option.getOrThrow(
      readStaticFile(toStaticFile("application/x-tss-framed; v=1", body))
    );

    expect(read.contentType).toBe("application/x-tss-framed; v=1");
    expect([...read.body]).toEqual([0, 10, 255, 1]);
  });

  it("reads a file without its content type line as none", () => {
    expect(Option.isNone(readStaticFile(new Uint8Array([1, 2, 3])))).toBe(true);
  });
});
