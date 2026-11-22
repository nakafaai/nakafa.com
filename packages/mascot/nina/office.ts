import { deed } from "@repo/mascot/nina/deed";
import {
  coil,
  compass,
  keyring,
  padlock,
  pennant,
  photo,
  puzzle,
  quill,
  returned,
  sieve,
  signpost,
  swap,
  toggle,
  unplugged,
} from "@repo/mascot/nina/goods/office";

/**
 * The acts of a school's office: what is chosen, opened, switched on or handed back, each one for the one state of a
 * page it tells. `still` is the moment that shows the act best.
 */
export const OFFICE = {
  /** A cable wound up with its plug free: a connection to make again. */
  coiling: { pose: deed("front", coil, ["calm", "focused"]), still: 0.43 },
  /** Pointing the way on a signpost: this page is not for you, another is. */
  directing: {
    pose: deed("beside", signpost, ["calm", "happy"]),
    still: 0.43,
  },
  /** A starting flag raised: open a period, and what it holds begins. */
  flagging: { pose: deed("up", pennant, ["happy", "proud"]), still: 0.43 },
  /** A ring of keys, one for each room: every exam with its rooms. */
  jingling: { pose: deed("out", keyring, ["happy", "curious"]), still: 0.43 },
  /** A padlock held shut: a service that is locked. */
  latching: { pose: deed("chest", padlock, ["calm", "shy"]), still: 0.43 },
  /** A compass finding the way: choose another unit. */
  orienting: {
    pose: deed("chest", compass, ["curious", "aha"]),
    still: 0.43,
  },
  /** A class photo: each student placed in this class. */
  picturing: { pose: deed("front", photo, ["happy", "proud"]), still: 0.43 },
  /** The missing piece of a puzzle: an exam needs a unit first. */
  puzzling: {
    pose: deed("front", puzzle, ["thoughtful", "aha"]),
    still: 0.43,
  },
  /** A quill ready for the first line: the note that starts a report card. */
  quilling: { pose: deed("out", quill, ["focused", "happy"]), still: 0.43 },
  /** A sheet handed back with a red cross: a file that cannot be read in. */
  returning: { pose: deed("out", returned, ["sad", "shy"]), still: 0.43 },
  /** A sieve with nothing caught: no answer matches this filter. */
  sifting: { pose: deed("out", sieve, ["curious", "confused"]), still: 0.43 },
  /** A big switch slid to on: only what a student switches on shows. */
  toggling: { pose: deed("front", toggle, ["focused", "happy"]), still: 0.43 },
  /** Two cards changing hands: choose another unit for its cohorts. */
  trading: { pose: deed("apart", swap, ["curious", "happy"]), still: 0.43 },
  /** A plug pulled out: an agent that cannot connect. */
  unplugging: {
    pose: deed("out", unplugged, ["sad", "surprised"]),
    still: 0.43,
  },
};
