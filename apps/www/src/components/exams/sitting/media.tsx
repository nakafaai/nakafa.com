import type { PlayableMedia } from "@repo/backend/confect/exams/media";
import { Array as Arr } from "effect";

/**
 * A question's media on its paper, above its text, in the editor, the sitting and the try alike: an audio clip the
 * student plays, or a video from its link. A clip loads when the student plays it, so a paper of many questions
 * spends no egress on what nobody opens. The teacher's words say what each one holds.
 */
export function PaperMedia({
  items,
}: {
  readonly items: readonly (typeof PlayableMedia.Type)[];
}) {
  return Arr.map(items, (item) =>
    item.kind === "audio" ? (
      <figure className="grid gap-2" key={item.url}>
        <audio
          aria-label={item.alt}
          className="w-full"
          controls
          preload="none"
          src={item.url}
        >
          <track kind="captions" />
        </audio>
        <figcaption className="text-muted-foreground text-sm">
          {item.alt}
        </figcaption>
      </figure>
    ) : (
      <iframe
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-lg border-0"
        key={item.video}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-presentation allow-same-origin allow-scripts"
        src={`https://www.youtube-nocookie.com/embed/${item.video}`}
        title={item.alt}
      />
    )
  );
}
