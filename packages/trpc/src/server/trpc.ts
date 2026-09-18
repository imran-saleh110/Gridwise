import { initTRPC } from "@trpc/server";
import { transformer } from "../transformer.ts";
import type { Context } from "./context.ts";

const { router, procedure } = initTRPC
  .context<Context>()
  .create({ transformer });

export { procedure as publicProcedure, router };
