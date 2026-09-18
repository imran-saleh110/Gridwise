import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "./server/router.ts";
import { transformer } from "./transformer.ts";

export function createServerClient(url: string) {
  return createTRPCClient<AppRouter>({
    links: [httpBatchLink({ transformer, url })],
  });
}
