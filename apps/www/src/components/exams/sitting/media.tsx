import type { PlayableMedia } from "@repo/backend/confect/exams/media";
import { YoutubePlayer } from "@repo/design-system/components/markdown/youtube-player";
import { Array as Arr } from "effect";

/**
 * A question's media on its paper, above its text, in the editor, the sitting and the try alike: an audio clip the
 * student plays, or a video from its link. Both load when the student plays them, so a paper of many questions
 * spends no egress on what nobody opens, and a clip whose address is still to come stands in its place. A video
 * keeps the student on the paper. The teacher's words say what each one holds.
 */
export function PaperMedia({
  items,
}: {
  readonly items: readonly (typeof PlayableMedia.Type)[];
}) {
  return Arr.map(items, (item) =>
    item.kind === "audio" ? (
      <figure className="grid gap-2" key={item.alt}>
        <audio
          aria-label={item.alt}
          className="w-full"
          controls
          preload="none"
          src={item.url === "" ? undefined : item.url}
        >
          <track kind="captions" />
        </audio>
        <figcaption className="text-muted-foreground text-sm">
          {item.alt}
        </figcaption>
      </figure>
    ) : (
      <div
        className="aspect-video w-full overflow-hidden rounded-lg"
        key={item.video}
      >
        <YoutubePlayer label={item.alt} sealed videoId={item.video} />
      </div>
    )
  );
}
