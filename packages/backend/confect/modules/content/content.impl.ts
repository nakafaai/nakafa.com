import { audioStudiesLayer } from "@repo/backend/confect/modules/content/audioStudies/audioStudies.impl";
import { commentsLayer } from "@repo/backend/confect/modules/content/comments/comments.impl";
import { contentSyncLayer } from "@repo/backend/confect/modules/content/contentSync/contentSync.impl";
import { contentsLayer } from "@repo/backend/confect/modules/content/contents/contents.impl";
import { subjectSectionsLayer } from "@repo/backend/confect/modules/content/subjectSections/subjectSections.impl";
import { Layer } from "effect";

export const contentLayer = Layer.mergeAll(
  commentsLayer,
  contentsLayer,
  contentSyncLayer,
  audioStudiesLayer,
  subjectSectionsLayer
);
