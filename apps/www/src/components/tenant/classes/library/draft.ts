import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import {
  LibraryTitle,
  LinkAddress,
} from "@repo/backend/confect/classroom/library/item";
import { Match, Option, Schema, String as Str } from "effect";

/** The extension at the end of a file name, which a title leaves out. */
const EXTENSION = /\.[^.]*$/u;

/** One file that the teacher picked, as the Picker names it. */
export const PickedFile = Schema.Struct({
  id: Schema.String,
  mimeType: Schema.String,
  name: Schema.String,
});

/** One file that the teacher picked in Google Drive. */
export type DriveFile = typeof PickedFile.Type;

/** What the dialog adds: a file from the device, a file from Google Drive, or a link. */
export const AddMode = Schema.Literals(["file", "drive", "link"]);

/**
 * How the Drive tab stands: `picking` from the press until Google's Picker answers, and `missing` when the
 * account has no Drive to pick from, which the tab says with the way to connect it.
 */
const DriveStep = Schema.Literals(["idle", "picking", "missing"]);

/**
 * What the add dialog holds: a source per mode, which stays while the teacher moves between the tabs, the
 * title they share, and the tab that says which source counts.
 */
const LibraryDraft = Schema.Struct({
  address: Schema.String,
  drive: Schema.Option(PickedFile),
  driveStep: DriveStep,
  file: Schema.NullOr(Schema.instanceOf(File)),
  mode: AddMode,
  title: Schema.String,
});
type LibraryDraft = typeof LibraryDraft.Type;

/** One change to the draft, from a field, from the Picker, or from a send that came back. */
const DraftChange = Schema.Union([
  Schema.TaggedStruct("address", { text: Schema.String }),
  Schema.TaggedStruct("cleared", {}),
  Schema.TaggedStruct("file", { file: LibraryDraft.fields.file }),
  Schema.TaggedStruct("missing", {}),
  Schema.TaggedStruct("mode", { mode: AddMode }),
  Schema.TaggedStruct("picked", { picked: LibraryDraft.fields.drive }),
  Schema.TaggedStruct("picking", {}),
  Schema.TaggedStruct("reset", {}),
  Schema.TaggedStruct("restored", {
    address: Schema.String,
    title: Schema.String,
  }),
  Schema.TaggedStruct("title", { text: Schema.String }),
]);

/** The dialog as it first opens: on a device file, with nothing chosen. */
export const EMPTY_DRAFT: LibraryDraft = {
  address: "",
  drive: Option.none(),
  driveStep: "idle",
  file: null,
  mode: "file",
  title: "",
};

/** The title a file gives an item: its name without the extension, as long as a title may be. */
const titleOf = (name: string) =>
  Str.trim(name.replace(EXTENSION, "")).slice(0, 120);

/** Names the draft after a chosen file when no title was written yet. */
const namedAfter = (draft: LibraryDraft, name: string): LibraryDraft =>
  Str.trim(draft.title) === "" ? { ...draft, title: titleOf(name) } : draft;

/** The draft after one change. Leaving a tab drops its `missing` sentence, which an account may have outgrown. */
export function stepDraft(
  draft: LibraryDraft,
  change: typeof DraftChange.Type
): LibraryDraft {
  return Match.valueTags(change, {
    address: ({ text }) => ({ ...draft, address: text }),
    cleared: () => ({ ...draft, drive: Option.none() }),
    file: ({ file }) =>
      file === null
        ? { ...draft, file }
        : namedAfter({ ...draft, file }, file.name),
    missing: () => ({ ...draft, driveStep: "missing" as const }),
    mode: ({ mode }) => ({
      ...draft,
      driveStep:
        draft.driveStep === "missing" ? ("idle" as const) : draft.driveStep,
      mode,
    }),
    picked: ({ picked }) =>
      Option.match(picked, {
        onNone: () => ({ ...draft, driveStep: "idle" as const }),
        onSome: (found) =>
          namedAfter(
            { ...draft, drive: picked, driveStep: "idle" },
            found.name
          ),
      }),
    picking: () => ({ ...draft, driveStep: "picking" as const }),
    reset: () => EMPTY_DRAFT,
    restored: ({ address, title }) => ({
      ...draft,
      address: draft.address === "" ? address : draft.address,
      mode: "link" as const,
      title: draft.title === "" ? title : draft.title,
    }),
    title: ({ text }) => ({ ...draft, title: text }),
  });
}

/** Whether a chosen file is larger than the library keeps. */
export const isOversize = (file: File | null) =>
  file !== null && file.size > LIBRARY_BYTE_LIMIT;

/** Whether the draft can be sent: the title holds, and so does the source of the tab it is on. */
export function isDraftReady(draft: LibraryDraft) {
  const sources = {
    drive: Option.isSome(draft.drive),
    file: draft.file !== null && !isOversize(draft.file),
    link: Schema.is(LinkAddress)(Str.trim(draft.address)),
  };
  return Schema.is(LibraryTitle)(Str.trim(draft.title)) && sources[draft.mode];
}
