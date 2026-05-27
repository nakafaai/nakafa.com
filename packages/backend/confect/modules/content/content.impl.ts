import { Layer } from "effect";
import { audioStudiesLayer } from "./audioStudies/audioStudies.impl";
import { commentsLayer } from "./comments/comments.impl";
import { contentSyncLayer } from "./contentSync/contentSync.impl";
import { contentsLayer } from "./contents/contents.impl";
import { subjectSectionsLayer } from "./subjectSections/subjectSections.impl";

export const contentLayer = Layer.mergeAll(
  commentsLayer,
  contentsLayer,
  contentSyncLayer,
  audioStudiesLayer,
  subjectSectionsLayer
);
