import { z } from "zod";

/**
 * Environment configuration for the LLM directive interpreter.
 *
 * Read from server-side environment variables only (`GROQ_API_KEY`, `LLM_*` — never
 * `NEXT_PUBLIC_*`). The API key stays on the server and is never logged or
 * returned to clients.
 *
 * Defaults target Groq on the Groq Cloud API (an OpenAI-compatible Chat Completions
 * endpoint with ultra-fast inference).
 */
export const llmEnvSchema = z.object({
  /** API key for Groq (GROQ_API_KEY or LLM_API_KEY). Required to interpret notes with live LLM. */
  GROQ_API_KEY: z.string().min(1).optional(),
  /** Fallback API key identifier. */
  LLM_API_KEY: z.string().min(1).optional(),
  /** Base URL of an OpenAI-compatible Chat Completions API. Defaults to Groq. */
  LLM_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  /** Maximum number of transport-level retries (network / 5xx / 429) per request. */
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(6),
  /** Model identifier to call on Groq. Defaults to openai/gpt-oss-20b. */
  LLM_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
  /** Structured-output strategy: json_object (prompt-enforced with JSON mode) or json_schema. */
  LLM_RESPONSE_MODE: z
    .enum(["json_schema", "json_object"])
    .default("json_object"),
  /** Base backoff delay in milliseconds; doubled after each retry. */
  LLM_RETRY_DELAY_MS: z.coerce.number().int().nonnegative().default(1000),
  /** Per-request timeout in milliseconds. */
  LLM_TIMEOUT: z.coerce.number().int().positive().default(15_000),
});

export type LLMConfig = z.infer<typeof llmEnvSchema>;

/**
 * Parses and validates LLM environment configuration.
 * Throws on structurally invalid values so misconfiguration fails fast at
 * startup instead of mid-request.
 */
export function getLLMConfig(env: NodeJS.ProcessEnv = process.env): LLMConfig {
  const parsed = llmEnvSchema.parse(env);
  const resolvedApiKey = parsed.GROQ_API_KEY ?? parsed.LLM_API_KEY;
  return {
    ...parsed,
    GROQ_API_KEY: resolvedApiKey,
    LLM_API_KEY: resolvedApiKey,
  };
}
