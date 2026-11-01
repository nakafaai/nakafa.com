import { Upload01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Effect, Result } from "effect";
import { useRef, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  type ReadRow,
  readDapodikSheet,
  type SheetProblem,
} from "@/components/tenant/roster/dapodik";

/** The file types the chooser offers: the XLSX file that Dapodik exports. */
const SHEET_TYPES =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Why a chosen file shows no preview: its sheet is refused, or the file cannot be read at all. */
export type FileProblem = typeof SheetProblem.Type | "unreadable";

/**
 * Reads the first sheet of an XLSX file in the browser. The reader loads only when the Admin
 * chooses a file, so it stays out of the page's first JavaScript, and the file never leaves
 * the device: only the rows the Admin applies reach the server (ADR 0015).
 */
const readFile = (file: File) =>
  Effect.tryPromise(async () => {
    const { readSheet } = await import("read-excel-file/browser");
    return readSheet(file);
  }).pipe(Effect.map(readDapodikSheet));

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
      const read = await Effect.runPromise(Effect.result(readFile(file)));
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
        accept={SHEET_TYPES}
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
