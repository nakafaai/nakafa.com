import {
  buildPagefindIndex,
  handlePagefindError,
} from "@/scripts/pagefind/build";

buildPagefindIndex().catch(handlePagefindError);
