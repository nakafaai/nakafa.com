import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { parseSources } from "#scripts/check/source";
import { inspectToastSource } from "#scripts/check/toasts";

const COMPONENT = "apps/www/components/example/toast.tsx";
const HELPER = "packages/design-system/lib/toast/notify.ts";
const TOASTER = "packages/design-system/components/ui/sonner.tsx";
const TEST_MODULE = "apps/www/components/example/toast.test.ts";
const SONNER_RULE =
  "import toast from @repo/design-system/lib/toast/notify instead of sonner, which only the Toaster and that helper import";
const COPY_RULE =
  'pass toast copy from a translator, such as tToast("action-error.title"), instead of literal text, a template, a concatenation, a joined list, or a spread';
const NAMESPACE_RULE =
  'translate toast copy with useTranslations("Toast") in the same module, so that every toast message is measured in that namespace';

/** Inspects one module with the toast policy alone. */
function inspect(sourceText: string, file = COMPONENT) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectToastSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Toast source policy", () => {
  it.effect(
    "accepts copy from the Toast namespace and the copy a caller passes in",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
export function reportFailure(message: string, detail: string) {
  const tToast = useTranslations("Toast");
  toast.error(message, { description: detail });
  toast.info(tToast("deleted.title"), {
    action: { label: tToast("undo.title"), onClick: () => undefined },
    duration: 5000,
  });
  toast.success(tToast(done ? "saved.title" : "kept.title"), {
    description: tToast("saved.description"),
    position: "bottom-center",
  });
  toast.dismiss("shown");
}`),
          []
        );
      })
  );

  it.effect(
    "rejects literal text, a template, a concatenation, a joined list, and a spread",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
toast.error("Could not save.");
toast.success(\`Saved \${name}.\`);
toast.info(tToast("a.title") + "!");
toast.error([tToast("a.title"), tToast("b.title")].join(" "));
toast.error(...args);`),
          [
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
          ]
        );
      })
  );

  it.effect(
    "rejects literal text in a description and in an action label",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
const tToast = useTranslations("Toast");
toast.info(tToast("deleted.title"), {
  action: { label: "Undo", onClick: () => undefined },
  description: "Try again.",
});`),
          [`${COMPONENT}: ${COPY_RULE}.`, `${COMPONENT}: ${COPY_RULE}.`]
        );
      })
  );

  it.effect("rejects a translator that is not the Toast namespace", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
const t = useTranslations("Ai");
toast.error(t("failures.connection"));
toast.error(useTranslations("Common")("action-error.title"));`),
        [`${COMPONENT}: ${NAMESPACE_RULE}.`, `${COMPONENT}: ${NAMESPACE_RULE}.`]
      );
    })
  );

  it.effect("rejects a key that a translator of another namespace picks", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
const t = useTranslations("Ai");
toast.error(t(code));`),
        [`${COMPONENT}: ${NAMESPACE_RULE}.`]
      );
    })
  );

  it.effect(
    "rejects the toast library outside the Toaster and the helper",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { toast } from "sonner";`),
          [`${COMPONENT}: ${SONNER_RULE}.`]
        );
      })
  );

  it.effect("accepts the toast library in the Toaster and in the helper", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`import { toast } from "sonner";`, TOASTER),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(`import { toast } from "sonner";`, HELPER),
        []
      );
    })
  );

  it.effect(
    "judges a translator by its namespace, awaited or not, and a written value by its text",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { getTranslations, useTranslations } from "next-intl";
const label = "plain";
const tToast = await getTranslations("Toast");
const tUnnamed = useTranslations();
toast.error(tToast("a.title"));
toast.error(label);
toast.error(tUnnamed("a.title"));
toast.error();`),
          [`${COMPONENT}: ${COPY_RULE}.`, `${COMPONENT}: ${NAMESPACE_RULE}.`]
        );
      })
  );

  it.effect("rejects literal text inside a condition or a parenthesis", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
const tToast = useTranslations("Toast");
toast.success(done ? "Saved." : tToast("saved.title"));
toast.error(("Could not save."));`),
        [`${COMPONENT}: ${COPY_RULE}.`, `${COMPONENT}: ${COPY_RULE}.`]
      );
    })
  );

  it.effect(
    "rejects literal text behind a type assertion, satisfies, a non-null assertion, or a method call",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
toast.error("Saved." as string);
toast.error("Saved." satisfies string);
toast.error("Saved."!);
toast.error("Saved.".trim());`),
          [
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
          ]
        );
      })
  );

  it.effect(
    "rejects a variable that holds literal text, and a shorthand option that does",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
const tToast = useTranslations("Toast");
const label = "Could not save.";
const description = "Try again.";
toast.error(label);
toast.error(tToast("a.title"), { description });
toast.error(label.trim());`),
          [
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
            `${COMPONENT}: ${COPY_RULE}.`,
          ]
        );
      })
  );

  it.effect(
    "judges a translator bound to two namespaces in one module as untrusted",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
function saved() {
  const tToast = useTranslations("Toast");
  toast.success(tToast("saved.title"));
}
function failed() {
  const tToast = useTranslations("Ai");
  toast.error(tToast("failures.connection"));
}`),
          [
            `${COMPONENT}: ${NAMESPACE_RULE}.`,
            `${COMPONENT}: ${NAMESPACE_RULE}.`,
          ]
        );
      })
  );

  it.effect(
    "accepts a fallback, a shorthand option that is a value, a computed option, and a spread option",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
const tToast = useTranslations("Toast");
toast.error(message ?? tToast("a.title"), {
  description,
  [key]: "not copy",
  ...rest,
});`),
          []
        );
      })
  );

  it.effect(
    "rejects a copy object that a caller passes on with written text",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
const tToast = useTranslations("Toast");
reportFailure(error, { title: "Could not save." });
reportFailure(error, { title: tToast("failure.title"), description: tToast("failure.description") });`),
          [`${COMPONENT}: ${COPY_RULE}.`]
        );
      })
  );

  it.effect(
    "leaves a title and a description that a module handling no copy passes on, such as a schema annotation, alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
const schema = Schema.String.annotations({ title: "Equation", description: "Solves an equation." });`),
          []
        );
      })
  );

  it.effect("rejects a copy object typed ToastCopy with written text", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
const copy: ToastCopy = { title: "Saved." };
const other = { title: "Saved." } satisfies ToastCopy;`),
        [`${COMPONENT}: ${COPY_RULE}.`, `${COMPONENT}: ${COPY_RULE}.`]
      );
    })
  );

  it.effect(
    "reads the copy of each branch of a condition, and the copy object a ToastCopy annotation gives",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import { toast } from "@repo/design-system/lib/toast/notify";
import { useTranslations } from "next-intl";
const tToast = useTranslations("Toast");
const tAi = useTranslations("Ai");
toast.success(done ? tToast("saved.title") : tAi("failures.connection"));
toast.success(done ? tToast("saved.title") : "Saved.");`),
          [`${COMPONENT}: ${NAMESPACE_RULE}.`, `${COMPONENT}: ${COPY_RULE}.`]
        );
      })
  );

  it.effect(
    "judges a ToastCopy value only where it is an object of copy, and reads a spread as no copy",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
let unset: ToastCopy;
const made: ToastCopy = copyFor(error);
const merged: ToastCopy = { ...base, title: "Saved." };
const other: ToastCopy = { detail: "Saved." };
const computed: ToastCopy = { [key]: "Saved." };
const asserted = copyFor(error) as ToastCopy;`),
          [`${COMPONENT}: ${COPY_RULE}.`]
        );
      })
  );

  it.effect("reads only the toast export of the helper module", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
import helper from "@repo/design-system/lib/toast/notify";
import { other } from "@repo/design-system/lib/toast/notify";
helper.error("Not judged.");
other.error("Not judged.");`),
        []
      );
    })
  );

  it.effect("leaves a test module alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `
import { toast } from "sonner";
toast.error("Saved.");`,
          TEST_MODULE
        ),
        []
      );
    })
  );
});
