import {
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/convex/tryouts/products";
import type { TryoutPartKey } from "@repo/backend/convex/tryouts/schema";
import { getExerciseCount } from "@repo/contents/_lib/exercises";
import {
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import type { Locale } from "@repo/contents/_types/content";
import { getSubjects } from "@repo/contents/exercises/high-school/_data/subject";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect } from "effect";

interface StaticTryoutPart {
  partKey: TryoutPartKey;
  questionCount: number;
  setSlug: string;
}

export interface StaticTryout {
  cycleKey: string;
  label: string;
  locale: Locale;
  partCount: number;
  parts: StaticTryoutPart[];
  product: TryoutProduct;
  slug: string;
  totalQuestionCount: number;
}

const SNBT_CATEGORY = "high-school";
const SNBT_TYPE = "snbt";
const YEAR_SEGMENT_REGEX = /^\d{4}$/;
const snbtPartKeys = getSubjects("snbt").map((subject) => subject.label);

function getTryoutCycleKey(path: string) {
  const segments = cleanSlug(path).split("/");
  const cycleKey = segments.at(-1);

  if (!(cycleKey && YEAR_SEGMENT_REGEX.test(cycleKey))) {
    return null;
  }

  return cycleKey;
}

function getTryoutSetName(path: string) {
  const segments = cleanSlug(path).split("/");

  return segments.at(-1) ?? null;
}

function countExercises(filePath: string) {
  return Effect.runPromise(
    Effect.match(getExerciseCount(filePath), {
      onFailure: () => 0,
      onSuccess: (count: number) => count,
    })
  );
}

async function getStaticSnbtTryouts(locale: Locale): Promise<StaticTryout[]> {
  const groupedTryouts = new Map<
    string,
    {
      cycleKey: string;
      label: string;
      parts: StaticTryoutPart[];
      setKey: string;
    }
  >();

  for (const partKey of snbtPartKeys) {
    const materials = await getMaterials(
      getMaterialPath(SNBT_CATEGORY, SNBT_TYPE, partKey),
      locale
    );

    for (const material of materials) {
      const cycleKey = getTryoutCycleKey(material.href);

      if (!cycleKey) {
        continue;
      }

      for (const item of material.items) {
        const setName = getTryoutSetName(item.href);

        if (!setName) {
          continue;
        }

        const tryoutKey = `${cycleKey}:${setName}`;
        const existingTryout = groupedTryouts.get(tryoutKey);
        const setSlug = cleanSlug(item.href);
        const questionCount = await countExercises(setSlug);

        if (existingTryout) {
          existingTryout.parts.push({
            partKey,
            questionCount,
            setSlug,
          });
          continue;
        }

        groupedTryouts.set(tryoutKey, {
          cycleKey,
          label: item.title,
          parts: [{ partKey, questionCount, setSlug }],
          setKey: setName,
        });
      }
    }
  }

  const tryouts = Array.from(groupedTryouts.values())
    .filter((tryout) => {
      return (
        tryout.parts.length === snbtPartKeys.length &&
        snbtPartKeys.every((partKey) =>
          tryout.parts.some((part) => part.partKey === partKey)
        ) &&
        tryout.parts.every((part) => part.questionCount > 0)
      );
    })
    .map((tryout) => {
      const orderedParts = snbtPartKeys.flatMap((partKey) => {
        const part = tryout.parts.find((item) => item.partKey === partKey);

        return part ? [part] : [];
      });

      return {
        cycleKey: tryout.cycleKey,
        label: tryout.label,
        locale,
        partCount: orderedParts.length,
        parts: orderedParts,
        product: "snbt",
        slug: `${tryout.cycleKey}-${tryout.setKey}`,
        totalQuestionCount: orderedParts.reduce(
          (count, part) => count + part.questionCount,
          0
        ),
      } satisfies StaticTryout;
    });

  return [...tryouts].sort(tryoutProductPolicies.snbt.compareTryouts);
}

/** Returns build-time tryout routes derived from `@repo/contents`. */
export function getStaticTryouts(args: {
  locale: Locale;
  product: TryoutProduct;
}) {
  switch (args.product) {
    case "snbt":
      return getStaticSnbtTryouts(args.locale);
    default:
      return Promise.resolve([]);
  }
}

/** Resolves one build-time tryout record from the `@repo/contents` source of truth. */
export async function getStaticTryout(args: {
  locale: Locale;
  product: TryoutProduct;
  slug: string;
}) {
  const tryouts = await getStaticTryouts({
    locale: args.locale,
    product: args.product,
  });

  return tryouts.find((tryout) => tryout.slug === args.slug) ?? null;
}
