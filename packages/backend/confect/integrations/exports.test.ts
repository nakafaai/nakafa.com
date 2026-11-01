import { describe, expect, it } from "@effect/vitest";
import {
  encodeCsv,
  encodeXlsx,
} from "@repo/backend/confect/integrations/exports";
import { Effect } from "effect";

describe("encodeCsv", () => {
  it("writes the header and the rows with the line ends of RFC 4180", () => {
    expect(encodeCsv({ header: ["id", "name"], rows: [["1", "Raka"]] })).toBe(
      "id,name\r\n1,Raka"
    );
  });

  it("quotes a field that holds a comma, a quote or a line break", () => {
    expect(
      encodeCsv({ header: ["name"], rows: [['Raka, "R"'], ["a\nb"]] })
    ).toBe('name\r\n"Raka, ""R"""\r\n"a\nb"');
  });

  it("keeps a spreadsheet from reading a name as a formula", () => {
    expect(encodeCsv({ header: ["name"], rows: [["=1+1"], ["@a"]] })).toBe(
      "name\r\n'=1+1\r\n'@a"
    );
  });
});

describe("encodeXlsx", () => {
  it.effect("writes a zip, the container of an XLSX file", () =>
    Effect.gen(function* () {
      const bytes = yield* encodeXlsx({
        header: ["id", "name"],
        rows: [["1", "Raka"]],
      });

      expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
    })
  );
});
