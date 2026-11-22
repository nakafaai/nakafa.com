// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { readLedger, toLedgerPath, writeLedger } from "@/scripts/urls/ledger";

const ORIGIN = "https://nakafa.com";

describe("the ledger of published addresses", () => {
  it("writes every path once, sorted, and reads the same paths back", () => {
    const text = writeLedger(["/id", "/en/about", "/id", "/de/ueber-uns"]);

    expect(text).toBe("/de/ueber-uns\n/en/about\n/id\n");
    expect(readLedger(`\n${text}  \n`)).toStrictEqual([
      "/de/ueber-uns",
      "/en/about",
      "/id",
    ]);
  });

  it("writes an empty ledger as empty text", () => {
    expect(writeLedger([])).toBe("");
    expect(readLedger("")).toStrictEqual([]);
  });

  it("keeps the path of a site address and drops its query and fragment", () => {
    expect(toLedgerPath(`${ORIGIN}/en/about?ref=x#team`, ORIGIN)).toStrictEqual(
      Option.some("/en/about")
    );
    expect(toLedgerPath("/id/tentang", ORIGIN)).toStrictEqual(
      Option.some("/id/tentang")
    );
  });

  it("names no path for an address on another origin", () => {
    expect(toLedgerPath("https://discord.gg/nakafa", ORIGIN)).toStrictEqual(
      Option.none()
    );
  });
});
