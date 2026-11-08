import { Schema } from "effect";
import { EmojiEntry } from "@/components/tenant/classes/forum/emoji";
import data from "@/components/tenant/classes/forum/glyphs.json";

/**
 * The emoji of a class chat, which ship with the page: no third party serves a picker's data to a school (ADR 0025).
 * Each row of `glyphs.json` holds the emoji, its category, and its name then its keywords, comma separated, in
 * Indonesian, English and German, so a learner finds one in the language they search in. The set keeps what a class
 * writes with; a phone's keyboard holds every other emoji. This module loads on the first intent on an emoji button.
 */
export const GLYPHS = Schema.decodeUnknownSync(Schema.Array(EmojiEntry))(data);
