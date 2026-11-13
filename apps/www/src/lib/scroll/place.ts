import {
  Array as Arr,
  Effect,
  Number as Num,
  Option,
  Record as Rec,
  Schema,
  Tuple,
} from "effect";
import { KeyValueStore } from "effect/persistence";
import { keptStorage } from "@/components/player/storage";
import { reportClientException } from "@/lib/analytics/client";

/**
 * Where a reader left one chat, a class's chat, a thread or a chat with Nina: the message at the top of the view, how
 * far below the top of the list's content that message stood (below zero once its top scrolled past), and how many
 * loaded messages stood from it to the newest, so the chat reads enough on its next open to hold it. A chat left at its
 * newest edge keeps no place, so it opens there again.
 */
export const ChatPlace = Schema.Struct({
  depth: Schema.Int,
  id: Schema.String,
  offset: Schema.Finite,
});

/** The browser storage key of the places, by chat. */
const PLACES_KEY = "nakafa-chat-places";

/** How many chats the browser remembers a place for. The chat left longest ago leaves first. */
const KEPT_PLACES = 60;

/** The messages a chat reads past the place it was left at, for those that came since. */
const PLACE_MARGIN = 10;

const PlacesJson = Schema.fromJsonString(
  Schema.Record(Schema.String, ChatPlace)
);

const decodePlaces = Schema.decodeOption(PlacesJson);

/** Every kept place. Storage that no longer decodes reads as nothing kept, and the next write replaces it. */
const readPlaces = Effect.fn("scroll.place.places")(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const stored = yield* store.get(PLACES_KEY);
  return Option.getOrElse(
    Option.flatMap(Option.fromNullishOr(stored), decodePlaces),
    () => Rec.empty<string, typeof ChatPlace.Type>()
  );
});

/** The place the reader left `chat` at, if this browser kept one. */
export const readChatPlace = Effect.fn("scroll.place.read")(function* (
  chat: string
) {
  return Rec.get(yield* readPlaces(), chat);
});

/** Keeps where the reader stands in `chat` as its newest place, or forgets its place when they stand at its end. */
export const keepChatPlace = Effect.fn("scroll.place.keep")(function* (
  chat: string,
  place: Option.Option<typeof ChatPlace.Type>
) {
  const others = Rec.remove(yield* readPlaces(), chat);
  const places = Option.match(place, {
    onNone: () => others,
    onSome: (kept) =>
      Rec.fromEntries(
        Arr.takeRight(
          Arr.append(Rec.toEntries(others), Tuple.make(chat, kept)),
          KEPT_PLACES
        )
      ),
  });
  const text = yield* Schema.encodeEffect(PlacesJson)(places).pipe(
    Effect.orDie
  );
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.set(PLACES_KEY, text);
});

/** The place this browser kept for `chat`. A browser that refuses its storage keeps none, as a first visit does. */
export const readPlace = (chat: string) =>
  readChatPlace(chat).pipe(
    Effect.provide(keptStorage),
    Effect.orElseSucceed(() => Option.none<typeof ChatPlace.Type>())
  );

/** Keeps `chat`'s place in this browser. A browser that refuses its storage is reported, and the chat goes on. */
export const keepPlace = Effect.fn("scroll.place.save")(
  function* (chat: string, place: Option.Option<typeof ChatPlace.Type>) {
    yield* keepChatPlace(chat, place);
  },
  Effect.provide(keptStorage),
  Effect.catchTag("KeyValueStoreError", (error) =>
    reportClientException(error, { source: "lib/scroll/place" })
  )
);

/**
 * How many messages a chat reads first: one page, or as many as hold the message it was left at and those that came
 * since, up to `most`, so the place shows from the first answer with no page read after it.
 */
export const firstPageOf = (
  place: Option.Option<typeof ChatPlace.Type>,
  page: number,
  most: number
) =>
  Option.match(place, {
    onNone: () => page,
    onSome: (kept) =>
      Num.clamp(kept.depth + PLACE_MARGIN, { maximum: most, minimum: page }),
  });
