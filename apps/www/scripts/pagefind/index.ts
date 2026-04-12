import { buildPagefindIndex, handlePagefindError } from "./build";

buildPagefindIndex().catch(handlePagefindError);
