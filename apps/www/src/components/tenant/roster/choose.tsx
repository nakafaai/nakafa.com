import { Upload01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { DateTime, Effect, Record as Rec, Result } from "effect";
import { useRef, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  type ReadRow,
  readDapodikSheet,
  type SheetProblem,
  type SheetRead,
} from "@/components/tenant/roster/dapodik";
import {
  isBundleFile,
  readOneRoster,
} from "@/components/tenant/roster/oneroster";

/** The file types the chooser offers: the XLSX file that Dapodik exports, and a OneRoster CSV bundle. */
const FILE_TYPES =
  ".xlsx,.zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip";

/** The largest file an import reads: the target of the blueprint, 10 MB. */
const FILE_LIMIT = 10_000_000;

/** The answer for a file past the limit, which is read no further. */
const readFailure: typeof SheetRead.Type = {
  outcome: "refused",
  problem: "size",
};

/** Why a chosen file shows no preview: its sheet is refused, or the file cannot be read at all. */
export type FileProblem = typeof SheetProblem.Type | "unreadable";

/**
 * Reads a file in the browser, by what it holds and not by its name: a zip that holds
 * `users.csv` is a OneRoster bundle, and any other file is read as the first sheet of an XLSX
 * file. The readers load only when the Admin chooses a file, so they stay out of the page's
 * first JavaScript, and the file never leaves the device: only the rows the Admin applies
 * reach the server (ADR 0015, ADR 0029).
 */
const readFile = (file: File, today: DateTime.Utc) =>
  Effect.tryPromise(async () => {
    if (file.size > FILE_LIMIT) {
      return readFailure;
    }
    const { strFromU8, unzipSync } = await import("fflate");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const bundle = Rec.map(
      unzipSync(bytes, { filter: (entry) => isBundleFile(entry.name) }),
      (data) => strFromU8(data)
    );
    if (Rec.has(bundle, "users.csv")) {
      return readOneRoster(bundle);
    }
    const { readSheet } = await import("read-excel-file/browser");
    return readDapodikSheet(await readSheet(file), today);
  });

/**
 * Import: the hidden file chooser and its button, enabled from the first paint, since choosing a
 * file needs no data of the school. A read file hands its rows to the preview, and a refused or
 * unreadable one its problem; the button shows its work only while the file is read.
 */
export function RosterFileChoice({
  onProblem,
  onRows,
}: {
  onProblem: (problem: FileProblem) => void;
  onRows: (rows: readonly (typeof ReadRow.Type)[]) => void;
}) {
  const t = useTranslations("SchoolRoster");
  const input = useRef<HTMLInputElement>(null);
  const [isReading, startReading] = useTransition();

  const choose = (file: File) =>
    startReading(async () => {
      const read = await Effect.runPromise(
        Effect.result(readFile(file, DateTime.nowUnsafe()))
      );
      if (Result.isFailure(read)) {
        onProblem("unreadable");
        return;
      }
      if (read.success.outcome === "refused") {
        onProblem(read.success.problem);
        return;
      }
      onRows(read.success.rows);
    });

  return (
    <>
      <input
        accept={FILE_TYPES}
        aria-label={t("file-label")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            choose(file);
          }
        }}
        ref={input}
        type="file"
      />
      <Button
        disabled={isReading}
        onClick={() => input.current?.click()}
        type="button"
      >
        {isReading ? <Spinner isLoading /> : <HugeIcons icon={Upload01Icon} />}
        <span className="max-sm:sr-only">{t("import")}</span>
      </Button>
    </>
  );
}
