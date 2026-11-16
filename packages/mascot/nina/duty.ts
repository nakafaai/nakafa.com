import { deed } from "@repo/mascot/nina/deed";
import {
  abacus,
  apple,
  bell,
  binder,
  bubbles,
  cup,
  hook,
  hourglass,
  jar,
  keycard,
  prong,
  satchel,
  scale,
  sheaf,
  stopwatch,
  thermometer,
  trumpet,
  tube,
} from "@repo/mascot/nina/goods/desk";
import {
  binoculars,
  bow,
  brick,
  cap,
  feeder,
  gown,
  key,
  megaphone,
  radar,
  sign,
  stop,
} from "@repo/mascot/nina/goods/gear";
import {
  badge,
  blank,
  bookmark,
  calendar,
  certificate,
  cover,
  covers,
  dart,
  diploma,
  fan,
  frame,
  gradebook,
  inbox,
  insert,
  letter,
  marked,
  plan,
  ribbon,
  ruler,
  scissors,
  scroll,
  seal,
  sharpener,
  sheets,
  tags,
  ticket,
  tome,
  tray,
} from "@repo/mascot/nina/goods/paper";
import {
  atlas,
  cans,
  dustpan,
  ends,
  lamp,
  lantern,
  links,
  question,
  robot,
  switchboard,
  tangle,
  wrench,
} from "@repo/mascot/nina/goods/repair";
import {
  ajar,
  chairs,
  desks,
  door,
  doorway,
  height,
  hooks,
  letterbox,
  pile,
  pinboard,
  rack,
  shutter,
  small,
  stack,
} from "@repo/mascot/nina/goods/room";

/** The acts of what broke, got lost or is not connected. `still` is the moment that shows the act best. */
export const REPAIRS = {
  /** A lamp that is lit: a connection that works. */
  glowing: { pose: deed("out", lamp, ["happy", "proud"]), still: 0.43 },
  /** Two links she brings together: a parent and a child not linked yet. */
  linking: { pose: deed("apart", links, ["focused", "happy"]), still: 0.43 },
  /** Sweeping up the pieces: a page that broke. */
  mending: { pose: deed("low", dustpan, ["sad", "focused"]), still: 0.43 },
  /** A paper plane drawn back at her shoulder, ready to throw: be the first to post. */
  launching: { pose: deed("throw", dart, ["focused", "happy"]), still: 0.43 },
  /** A tin can telephone: a chat nobody has started. */
  phoning: { pose: deed("out", cans, ["curious", "hello"]), still: 0.43 },
  /** Restarting a small machine: an answer that failed. */
  rebooting: { pose: deed("front", robot, ["confused", "aha"]), still: 0.43 },
  /** A wrench on a loose nut: a read that failed. */
  repairing: {
    pose: deed("out", wrench, ["focused", "proud"], 3),
    still: 0.29,
  },
  /** A shrug under a question mark: a search with no answer. */
  shrugging: { pose: deed("over", question, ["confused", "shy"]), still: 0.43 },
  /** Two cable ends that do not meet: a connection that dropped. */
  splicing: {
    pose: deed("apart", ends, ["confused", "surprised"]),
    still: 0.43,
  },
  /** At a switchboard: the operators' console. */
  switching: {
    pose: deed("front", switchboard, ["focused", "aha"]),
    still: 0.43,
  },
  /** Following footprints with a lantern: a trail with nothing on it yet. */
  tracking: { pose: deed("low", lantern, ["curious", "aha"]), still: 0.43 },
  /** Untangling a cable: no connector by that name. */
  untangling: {
    pose: deed("front", tangle, ["confused", "focused"]),
    still: 0.43,
  },
  /** A map held upside down: a page that is not there. */
  wandering: {
    pose: deed("front", atlas, ["confused", "curious"]),
    still: 0.43,
  },
};

/** The acts of paper: what is written, signed, sorted and handed over. `still` is the moment that shows the act best. */
export const PAPERS = {
  /** A name badge without a name: the first questions. */
  badging: { pose: deed("front", badge, ["hello", "happy"]), still: 0.43 },
  /** Binding blank report covers: no reports to make yet. */
  binding: { pose: deed("front", covers, ["focused", "proud"]), still: 0.43 },
  /** A book closed on its ribbon: no lesson opened yet to pick up again. */
  bookmarking: {
    pose: deed("front", bookmark, ["calm", "happy"]),
    still: 0.43,
  },
  /** Collecting handed in sheets: no work yet. */
  collecting: { pose: deed("front", sheets, ["calm", "happy"]), still: 0.43 },
  /** Cutting login cards: none issued yet. */
  cutting: {
    pose: deed("out", scissors, ["focused", "proud"], 3),
    still: 0.29,
  },
  /** An open book of blank pages: what do you want to learn? */
  dreaming: { pose: deed("front", blank, ["curious", "aha"]), still: 0.43 },
  /** An empty in tray: no request yet. */
  emptying: { pose: deed("front", inbox, ["calm", "happy"]), still: 0.43 },
  /** Folding a letter into an envelope: no invitation waits. */
  folding: { pose: deed("chest", insert, ["focused", "happy"]), still: 0.43 },
  /** An empty picture frame: no child linked yet. */
  framing: { pose: deed("front", frame, ["curious", "shy"]), still: 0.43 },
  /** Filling a grade book: no grade yet. */
  grading: {
    pose: deed("front", gradebook, ["focused", "proud"], 1.6),
    still: 0.54,
  },
  /** A seal held up to the light: checking a record. */
  inspecting: { pose: deed("up", seal, ["focused", "aha"]), still: 0.43 },
  /** Handing over a sealed letter: an agent introduces itself. */
  introducing: { pose: deed("out", letter, ["hello", "happy"]), still: 0.43 },
  /** Leafing through a great book: no chapter by that name. */
  leafing: { pose: deed("front", tome, ["focused", "curious"]), still: 0.43 },
  /** Marking with a red pen: no answer to mark yet. */
  marking: {
    pose: deed("front", marked, ["focused", "proud"], 2.4),
    still: 0.36,
  },
  /** Cutting a ribbon: a school opens. */
  opening: {
    pose: deed("apart", ribbon, ["focused", "laughing"]),
    still: 0.43,
  },
  /** Turning a calendar page: no period yet. */
  paging: { pose: deed("front", calendar, ["thoughtful", "aha"]), still: 0.43 },
  /** Holding up a certificate: a record that is real. */
  presenting: {
    pose: deed("front", certificate, ["proud", "happy"]),
    still: 0.43,
  },
  /** A rolled diploma: no class to graduate yet. */
  rolling: { pose: deed("out", diploma, ["happy", "proud"]), still: 0.43 },
  /** Ruling a table: no row yet. */
  ruling: { pose: deed("front", ruler, ["focused", "proud"]), still: 0.43 },
  /** Sharpening a pencil: no exam yet. */
  sharpening: {
    pose: deed("front", sharpener, ["focused", "proud"], 3),
    still: 0.29,
  },
  /** Shuffling blank question cards: no question yet. */
  shuffling: {
    pose: deed("front", fan, ["focused", "winking"], 2.4),
    still: 0.36,
  },
  /** Sorting cards into a tray: no year group yet. */
  sorting: { pose: deed("front", tray, ["focused", "happy"]), still: 0.43 },
  /** Blank name tags on a string: nobody to enrol yet. */
  tagging: { pose: deed("front", tags, ["calm", "happy"]), still: 0.43 },
  /** Checking a ticket: not allowed in. */
  ticketing: { pose: deed("out", ticket, ["focused", "calm"], 3), still: 0.29 },
  /** An empty report cover held open: no report released yet. */
  unfolding: { pose: deed("front", cover, ["curious", "calm"]), still: 0.43 },
  /** Unrolling a syllabus. */
  unrolling: {
    pose: deed("front", scroll, ["curious", "happy"], 1.6),
    still: 0.54,
  },
  /** An usher with a seat plan: no seat matches. */
  ushering: { pose: deed("front", plan, ["curious", "aha"], 1.4), still: 0.62 },
};

/** The acts of a room: a thing that stands on the floor beside her. `still` is the moment that shows the act best. */
export const ROOMS = {
  /** Setting out a desk: no exam room yet. */
  arranging: { pose: deed("beside", desks, ["focused", "proud"]), still: 0.43 },
  /** Waiting by a letterbox: no grade released yet. */
  awaiting: {
    pose: deed("beside", letterbox, ["calm", "curious"], 1.6),
    still: 0.54,
  },
  /** A stand of hats nobody wears: no role granted yet. */
  hatting: { pose: deed("beside", rack, ["curious", "happy"]), still: 0.43 },
  /** Counting empty coat hooks: nobody in this class yet. */
  hooking: { pose: deed("beside", hooks, ["calm", "curious"]), still: 0.43 },
  /** Knocking on a door: no course behind it yet. */
  knocking: {
    pose: deed("beside", door, ["curious", "hello"], 5),
    still: 0.17,
  },
  /** Measuring herself on a height chart: how you grow. */
  measuring: {
    pose: deed("beside", height, ["curious", "proud"]),
    still: 0.43,
  },
  /** A door left ajar: no room in that state. */
  peeking: {
    pose: deed("beside", ajar, ["curious", "surprised"]),
    still: 0.43,
  },
  /** Pinning a note to a board: what Nina keeps in mind. */
  pinning: {
    pose: deed("beside", pinboard, ["focused", "happy"]),
    still: 0.43,
  },
  /** Waiting at a closed shutter: not open yet. */
  queueing: {
    pose: deed("beside", shutter, ["calm", "thoughtful"], 1.4),
    still: 0.62,
  },
  /** Empty chairs set out: no student yet. */
  seating: { pose: deed("beside", chairs, ["calm", "happy"]), still: 0.43 },
  /** A pile of empty covers: no student to report on yet. */
  stacking: { pose: deed("beside", pile, ["focused", "proud"]), still: 0.43 },
  /** Walking with a small one: what a parent sees. */
  strolling: {
    pose: deed("beside", small, ["happy", "laughing"], 3),
    still: 0.29,
  },
  /** Stacking chairs: no seat taken yet. */
  tidying: { pose: deed("beside", stack, ["focused", "proud"]), still: 0.43 },
  /** Holding the door open: nobody has joined yet. */
  welcoming: { pose: deed("beside", doorway, ["hello", "happy"]), still: 0.43 },
};

/** The acts of a desk: a thing she weighs, counts, rings or hands out. `still` is the moment that shows the act best. */
export const DESKS = {
  /** Filling in an answer sheet: sitting an exam. */
  answering: {
    pose: deed("front", bubbles, ["focused", "proud"], 1.6),
    still: 0.54,
  },
  /** Holding out a key card: no client connects yet. */
  carding: { pose: deed("out", keycard, ["hello", "happy"]), still: 0.43 },
  /** Casting a hook on a line: no webhook yet. */
  casting: { pose: deed("up", hook, ["focused", "curious"]), still: 0.43 },
  /** Dealing out exam sheets: making an exam. */
  dealing: { pose: deed("out", sheaf, ["focused", "happy"], 2.4), still: 0.36 },
  /** A postman's bag with nothing in it: no change sent yet. */
  delivering: { pose: deed("front", satchel, ["calm", "happy"]), still: 0.43 },
  /** Ringing the desk bell: a right answer. */
  dinging: { pose: deed("out", bell, ["happy", "laughing"], 6), still: 0.14 },
  /** Blowing dust off a binder: the archive. */
  dusting: {
    pose: deed("front", binder, ["focused", "surprised"]),
    still: 0.43,
  },
  /** Reading a thermometer chart: how the grades stand. */
  gauging: {
    pose: deed("out", thermometer, ["curious", "proud"], 1.2),
    still: 0.72,
  },
  /** An apple for the teacher: no teacher yet. */
  gifting: { pose: deed("out", apple, ["hello", "happy"]), still: 0.43 },
  /** Invigilating with a stopwatch: no signal yet. */
  invigilating: {
    pose: deed("out", stopwatch, ["focused", "calm"], 1),
    still: 0.86,
  },
  /** Listening with an ear trumpet: no channel by that name. */
  listening: { pose: deed("out", trumpet, ["curious", "aha"]), still: 0.43 },
  /** A warm cup: no exam to sit. */
  lounging: { pose: deed("out", cup, ["calm", "happy"], 1.4), still: 0.62 },
  /** A plug held out: ready to connect. */
  offering: { pose: deed("out", prong, ["hello", "happy"]), still: 0.43 },
  /** An empty jar of notes: nothing remembered yet. */
  storing: { pose: deed("front", jar, ["curious", "happy"]), still: 0.43 },
  /** Adding up on an abacus: the marks of one report. */
  tallying: { pose: deed("front", abacus, ["focused", "aha"]), still: 0.43 },
  /** Watching an hourglass: no exam released yet. */
  timing: {
    pose: deed("out", hourglass, ["calm", "thoughtful"], 0.8),
    still: 1.08,
  },
  /** An open diploma tube with nothing in it: no transcript yet. */
  uncapping: { pose: deed("out", tube, ["curious", "surprised"]), still: 0.43 },
  /** Weighing on a balance: no grading scale yet. */
  weighing: {
    pose: deed("front", scale, ["thoughtful", "aha"], 1.4),
    still: 0.62,
  },
};

/** The acts of a tool she wears, raises or looks through. `still` is the moment that shows the act best. */
export const GEARS = {
  /** Brushing a cap: no graduate yet. */
  brushing: { pose: deed("front", cap, ["focused", "proud"], 3), still: 0.29 },
  /** Laying a first brick: no unit yet. */
  building: { pose: deed("low", brick, ["focused", "proud"]), still: 0.43 },
  /** Calling a roll: no student sat this yet. */
  calling: {
    pose: deed("out", megaphone, ["hello", "laughing"], 3),
    still: 0.29,
  },
  /** Feeding a sheet into a tray: reading a file. */
  feeding: {
    pose: deed("front", feeder, ["focused", "happy"], 1.6),
    still: 0.54,
  },
  /** A stop sign: a connection that was refused. */
  halting: { pose: deed("up", stop, ["focused", "calm"]), still: 0.43 },
  /** A bow tied round her arm: a memory she cannot find. */
  knotting: { pose: deed("up", bow, ["thoughtful", "aha"]), still: 0.43 },
  /** A door sign without a name: no classroom yet. */
  labeling: { pose: deed("out", sign, ["focused", "happy"]), still: 0.43 },
  /** A gown back on its hanger: this group does not graduate. */
  robing: { pose: deed("up", gown, ["calm", "thoughtful"]), still: 0.43 },
  /** A calm radar: no signal recorded. */
  scanning: { pose: deed("front", radar, ["calm", "focused"], 1), still: 0.86 },
  /** Looking through binoculars: who needs help. */
  scouting: {
    pose: deed("eyes", binoculars, ["curious", "aha"], 1.4),
    still: 0.62,
  },
  /** A key that does not fit: this cannot be opened here. */
  unlocking: { pose: deed("out", key, ["confused", "sad"]), still: 0.43 },
};
