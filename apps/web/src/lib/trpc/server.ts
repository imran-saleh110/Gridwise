import { createServerClient } from "@repo/trpc";
import { trpcUrl } from "./config.ts";

const serverClient = createServerClient(trpcUrl());

export { serverClient };
