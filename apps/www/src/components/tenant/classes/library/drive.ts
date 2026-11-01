import type { Ref } from "@confect/core";
import type connectors from "@repo/backend/confect/_generated/refs/connectors";
import { LIBRARY_ACCEPT } from "@repo/backend/confect/classroom/library/item";
import { Array as Arr, Data, Effect, Option, Schema } from "effect";
import {
  type DriveFile,
  PickedFile,
} from "@/components/tenant/classes/library/draft";

/** Google's script that loads its Picker. The page loads it only when a teacher opens Drive. */
const PICKER_SCRIPT = "https://apis.google.com/js/api.js";

/** How long the dialog waits for Google's script and its Picker. A stalled load fires no event of its own. */
const PICKER_LOAD_TIMEOUT = "15 seconds";

/** What the Picker needs from the server: the teacher's Drive token, the project's browser key, and its number. */
type PickerKeys = NonNullable<Ref.Returns<typeof connectors.drive.pickerToken>>;

/** One view of Drive that the Picker shows. */
interface DocsView {
  setMimeTypes: (types: string) => DocsView;
}

/** The Picker as it is built, then shown. */
interface PickerBuilder {
  addView: (view: DocsView) => PickerBuilder;
  build: () => { dispose: () => void; setVisible: (visible: boolean) => void };
  setAppId: (appId: string) => PickerBuilder;
  setCallback: (callback: (answer: unknown) => void) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setLocale: (locale: string) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
}

/** The part of Google's Picker that the library and the exam import use. */
interface GooglePicker {
  DocsView: new (viewId: string) => DocsView;
  PickerBuilder: new () => PickerBuilder;
  ViewId: Record<"DOCS", string>;
}

declare global {
  /** What Google's script defines on the page: its loader, then the Picker it loads. */
  interface Window {
    gapi?: { load: (library: "picker", loaded: () => void) => void };
    google?: Partial<Record<"picker", GooglePicker>>;
  }
}

/** Google's script or its Picker did not load. */
export class PickerUnavailable extends Data.TaggedError("PickerUnavailable") {}

/** What the Picker answers each time it changes: its action, and the files of a pick. */
const PickerAnswer = Schema.Struct({
  action: Schema.String,
  docs: Schema.optionalKey(Schema.Array(PickedFile)),
});

/** Adds Google's script to the page once, and waits for it. A wait that is given up takes the script away, so the next press asks again. */
const loadScript = Effect.callback<void, PickerUnavailable>((resume) => {
  if (window.gapi !== undefined) {
    resume(Effect.void);
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = PICKER_SCRIPT;
  script.addEventListener("load", () => resume(Effect.void), { once: true });
  script.addEventListener(
    "error",
    () => {
      script.remove();
      resume(Effect.fail(new PickerUnavailable()));
    },
    { once: true }
  );
  document.head.append(script);
  return Effect.sync(() => script.remove());
});

/** Google's Picker, once its script and the Picker library loaded. */
const loadPicker = Effect.gen(function* () {
  yield* loadScript;
  const loader = window.gapi;
  if (loader === undefined) {
    return yield* new PickerUnavailable();
  }
  yield* Effect.callback<void>((resume) => {
    loader.load("picker", () => resume(Effect.void));
  });
  const picker = window.google?.picker;
  if (picker === undefined) {
    return yield* new PickerUnavailable();
  }
  return picker;
});

/**
 * Shows Google's Picker over the page with the teacher's own Drive, offering the
 * given file types, by default the PDFs and images the library keeps, in the
 * page's language. `hide` clears the page only once the Picker can show, so a
 * load that fails or stalls leaves the dialog where it is. It answers the picked
 * file, or none when the teacher closed it. The project's number lets the Picker
 * grant the picked file to Nakafa, which `drive.file` reads then.
 */
export const pickDriveFile = Effect.fn("classroom.library.pickDrive")(
  function* (
    keys: PickerKeys,
    locale: string,
    hide: () => void,
    accept = LIBRARY_ACCEPT
  ) {
    const picker = yield* loadPicker.pipe(
      Effect.timeoutOrElse({
        duration: PICKER_LOAD_TIMEOUT,
        orElse: () => Effect.fail(new PickerUnavailable()),
      })
    );
    hide();
    return yield* Effect.callback<Option.Option<DriveFile>>((resume) => {
      const shown = new picker.PickerBuilder()
        .addView(new picker.DocsView(picker.ViewId.DOCS).setMimeTypes(accept))
        .setAppId(keys.appId)
        .setDeveloperKey(keys.apiKey)
        .setOAuthToken(keys.accessToken)
        .setLocale(locale)
        .setCallback((answer) => {
          Option.map(
            Schema.decodeUnknownOption(PickerAnswer)(answer),
            ({ action, docs }) => {
              if (action === "picked") {
                resume(Effect.succeed(Arr.head(docs ?? [])));
              }
              if (action === "cancel") {
                resume(Effect.succeedNone);
              }
            }
          );
        })
        .build();
      shown.setVisible(true);
      return Effect.sync(() => shown.dispose());
    });
  }
);
