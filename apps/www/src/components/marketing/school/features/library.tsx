import {
  ArrowRight01Icon,
  Image01Icon,
  LibraryIcon,
  Link04Icon,
  Pdf02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import type { AnimationSequence } from "motion";
import { useFormatter, useTranslations } from "use-intl";
import { DEMO_TEACHER } from "@/components/marketing/school/features/cast";
import { LabGraph } from "@/components/marketing/school/features/graph";
import {
  ShelfCard,
  ShelfFolder,
  ShelfLesson,
  ShelfQuestion,
  ShelfSheet,
  ShelfVideo,
} from "@/components/marketing/school/features/shelf";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import { useFlowPlay } from "@/components/marketing/school/flow/stage";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";

/** A card lands with a small overshoot, like a thing put on a shelf. */
const LAND = [0.34, 1.56, 0.64, 1] as const;

/**
 * The story of the library picture, six seconds long: the teacher's video arrives on the shelf, its upload fills,
 * it lands with its New badge, and the chapter's folder counts one more.
 */
function composeShelf(stage: HTMLElement): AnimationSequence {
  const all = (selector: string) => stage.querySelectorAll(selector);

  return [
    [
      all("[data-arriving]"),
      { opacity: 0, scale: 0.94 },
      { at: 0, duration: 0.3 },
    ],
    [all("[data-new]"), { opacity: 0 }, { at: 0, duration: 0.2 }],
    [all("[data-progress]"), { scaleX: 0 }, { at: 0, duration: 0.01 }],
    [all('[data-count="before"]'), { opacity: 1 }, { at: 0, duration: 0.2 }],
    [all('[data-count="after"]'), { opacity: 0 }, { at: 0, duration: 0.2 }],
    [
      all("[data-arriving]"),
      { opacity: 1, scale: 1 },
      { at: 0.6, duration: 0.4, ease: LAND },
    ],
    [all("[data-uploading]"), { opacity: 1 }, { at: 0.7, duration: 0.2 }],
    [
      all("[data-progress]"),
      { scaleX: 1 },
      { at: 0.9, duration: 1.8, ease: "linear" },
    ],
    [all("[data-uploading]"), { opacity: 0 }, { at: 2.8, duration: 0.2 }],
    [
      all("[data-new]"),
      { opacity: [0, 1], scale: [0.9, 1] },
      { at: 2.9, duration: 0.3, ease: LAND },
    ],
    [all('[data-count="before"]'), { opacity: 0 }, { at: 2.9, duration: 0.15 }],
    [all('[data-count="after"]'), { opacity: 1 }, { at: 2.9, duration: 0.25 }],
    [stage, { opacity: 1 }, { at: 6, duration: 0.01 }],
  ];
}

/** Where the shelf stands in the library, and the teacher who keeps it. */
function ShelfHead() {
  const t = useTranslations("SchoolSite");
  const tClass = useTranslations("Classroom");

  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <HugeIcons
          className="text-muted-foreground shrink-0"
          icon={LibraryIcon}
        />
        <span className="text-muted-foreground shrink-0">
          {tClass("tabs-library")}
        </span>
        <HugeIcons
          className="text-muted-foreground shrink-0 rtl:rotate-180"
          icon={ArrowRight01Icon}
        />
        <span className="truncate font-medium">{t("demo-library-folder")}</span>
      </p>
      <p className="flex shrink-0 items-center gap-2 text-sm">
        <PersonAvatar
          aria-hidden="true"
          mascot={DEMO_TEACHER.mascot}
          size="sm"
        />
        <span className="max-sm:sr-only">{t("demo-teacher")}</span>
      </p>
    </div>
  );
}

/** The class's three chapters, the open one last, whose count rises as the video lands. */
function ShelfFolders() {
  const t = useTranslations("SchoolSite");

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-6">
      <ShelfFolder
        count={t("demo-library-items", { count: 8 })}
        name={t("demo-library-motion")}
        step={1}
        tone="yellow"
      />
      <ShelfFolder
        count={t("demo-library-items", { count: 6 })}
        name={t("demo-library-forces")}
        step={2}
        tone="green"
      />
      <ShelfFolder
        count={
          <>
            <span
              className="col-start-1 row-start-1 opacity-0"
              data-count="before"
            >
              {t("demo-library-items", { count: 5 })}
            </span>
            <span className="col-start-1 row-start-1" data-count="after">
              {t("demo-library-items", { count: 6 })}
            </span>
          </>
        }
        name={t("demo-library-folder")}
        step={3}
        tone="blue"
      />
    </div>
  );
}

/** What the open chapter holds: the teacher's worksheet, Nina's summary, the lab's graph, a lesson, a try-out and the video that arrives. */
function ShelfFiles() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      <ShelfCard
        icon={Pdf02Icon}
        kind={t("demo-kind-pdf")}
        meta={format.number(240, { style: "unit", unit: "kilobyte" })}
        name={t("demo-library-worksheet")}
        step={1}
      >
        <ShelfSheet nina={false} />
      </ShelfCard>
      <ShelfCard
        icon={Pdf02Icon}
        kind={t("demo-kind-pdf")}
        meta={format.number(96, { style: "unit", unit: "kilobyte" })}
        name={t("demo-library-summary")}
        step={2}
      >
        <ShelfSheet nina />
      </ShelfCard>
      <ShelfCard
        icon={Image01Icon}
        kind={t("demo-kind-image")}
        meta={format.number(1.2, { style: "unit", unit: "megabyte" })}
        name={t("demo-library-graph")}
        step={3}
      >
        <LabGraph />
      </ShelfCard>
      <ShelfCard
        icon={Link04Icon}
        kind={t("demo-kind-lesson")}
        meta="nakafa.com"
        name={t("demo-library-lesson")}
        step={1}
      >
        <ShelfLesson />
      </ShelfCard>
      <ShelfCard
        icon={Link04Icon}
        kind={t("demo-kind-tryout")}
        meta={t("demo-library-questions", { count: 10 })}
        name={t("demo-library-quiz")}
        step={2}
      >
        <ShelfQuestion />
      </ShelfCard>
      <div className="grid" data-arriving="">
        <ShelfCard
          icon={Link04Icon}
          kind={t("demo-kind-video")}
          meta={format.number(4, { style: "unit", unit: "minute" })}
          name={t("demo-library-video")}
          step={3}
        >
          <ShelfVideo fresh={t("demo-library-new")} />
        </ShelfCard>
      </div>
    </div>
  );
}

/**
 * The library part: under Nina, who reads, and her words, one chapter's shelf as the class's library keeps it. Its
 * folders stand in Nina's colours, and every thing the teacher shared shows as itself: the worksheet, Nina's summary,
 * the lab's graph, a Nakafa lesson, a try-out, and a video that arrives while the reader looks, the folder counting it.
 */
export function SchoolLibrary() {
  const t = useTranslations("SchoolSite");
  const stage = useFlowPlay(composeShelf);

  return (
    <FeatureRow id="library" layout="wide">
      <SchoolFeatureText feature="library">
        <Nina act="reading" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <div
          aria-label={t("library-picture")}
          className="mx-auto grid w-full max-w-5xl gap-6"
          ref={stage}
          role="img"
        >
          <ShelfHead />
          <ShelfFolders />
          <ShelfFiles />
        </div>
      </FeatureProduct>
    </FeatureRow>
  );
}
