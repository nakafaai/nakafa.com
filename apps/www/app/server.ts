import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

export default createServerEntry({
  fetch: createStartHandler(defaultStreamHandler),
});
