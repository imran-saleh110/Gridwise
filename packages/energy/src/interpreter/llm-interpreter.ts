import type { DirectiveInterpretation } from "../domain/directive.ts";
import type { Scenario } from "../domain/scenario.ts";
import {
  DirectiveInterpretationError,
  LLMProviderError,
} from "../errors/index.ts";
import {
  type LLMClient,
  OpenAICompatibleClient,
  type OpenAICompatibleClientOptions,
} from "../llm/client.ts";
import type { LLMConfig } from "../llm/config.ts";
import { getLLMConfig } from "../llm/config.ts";
import type { DirectiveInterpreter } from "./interpreter.ts";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.ts";
import {
  buildDirectiveInterpretationJSONSchema,
  parseDirectiveInterpretationOutput,
} from "./schemas.ts";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface LLMDirectiveInterpreterOptions {
  /** Chat-completions transport (injectable for tests). */
  readonly client: LLMClient;
  /**
   * Bounded retries on malformed LLM structured output (unparseable JSON,
   * hallucinated directive type, violated invariants). Defaults to 2.
   */
  readonly maxOutputRetries?: number;
  /** Base backoff delay in ms between malformed-output retries. Defaults to 300. */
  readonly retryDelayMs?: number;
}

/**
 * Teammate B's production directive interpreter: BLLM-orchestrated by an
 * OpenAI-compatible client pointed at Grok (see `getLLMConfig` defaults).
 *
 * Flow per note:
 *   1. Build a structured-output request (system prompt + note context).
 *   2. Ask the provider for one `DirectiveInterpretation` JSON object.
 *   3. Deterministically validate it with the Zod schema in `schemas.ts`.
 *   4. Retry (bounded) only on malformed output; propagate provider failures.
 *
 * Reads notes in parallel (1–3 per scenario) and returns one interpretation
 * per note in `note_index` order. `note_index` is pinned programmatically so
 * the mapping invariant can never be violated by model output.
 */
export class LLMDirectiveInterpreter implements DirectiveInterpreter {
  private readonly client: LLMClient;
  private readonly maxOutputRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: LLMDirectiveInterpreterOptions) {
    this.client = options.client;
    this.maxOutputRetries = options.maxOutputRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 300;
  }

  async interpret(
    notes: readonly string[],
    scenario: Scenario
  ): Promise<DirectiveInterpretation[]> {
    if (notes.length < 1 || notes.length > 3) {
      throw new DirectiveInterpretationError(
        "Expected between 1 and 3 operator notes."
      );
    }

    const interpretations: DirectiveInterpretation[] = [];
    for (let index = 0; index < notes.length; index += 1) {
      if (index > 0) {
        // biome-ignore lint/performance/noAwaitInLoops: sequential pacing avoids token-bucket burst limits on LLM APIs
        await sleep(350);
      }
      const note = notes[index];
      if (note !== undefined) {
        const interpretation = await this.interpretNote(
          note,
          index,
          notes.length,
          scenario
        );
        interpretations.push(interpretation);
      }
    }

    return interpretations;
  }

  private async interpretNote(
    note: string,
    index: number,
    totalNotes: number,
    scenario: Scenario
  ): Promise<DirectiveInterpretation> {
    const request = {
      jsonSchema: buildDirectiveInterpretationJSONSchema(),
      system: buildSystemPrompt(),
      user: buildUserPrompt(note, index, totalNotes, scenario),
    };

    const attemptSend = async (
      attempt: number
    ): Promise<DirectiveInterpretation> => {
      if (attempt > 0) {
        await sleep(this.retryDelayMs * 2 ** (attempt - 1));
      }

      // Provider/network failures already went through the client's bounded
      // retry-with-backoff and surface as LLMProviderError; propagate those.
      const completion = await this.client.completeStructured(request);
      const parsed = parseDirectiveInterpretationOutput(completion.contentText);
      if (parsed !== null) {
        return { ...parsed, note_index: index };
      }

      if (attempt >= this.maxOutputRetries) {
        throw new DirectiveInterpretationError(
          "The language model returned an invalid directive interpretation.",
          `LLM returned unparseable or invalid structured output for note ${index} after ${this.maxOutputRetries + 1} attempts.`
        );
      }

      return attemptSend(attempt + 1);
    };

    return await attemptSend(0);
  }
}

export interface CreateLLMDirectiveInterpreterOptions {
  /** Overrides environment-based LLM config (mainly for tests). */
  readonly config?: LLMConfig;
  /** Injectable fetch transport, e.g. for offline tests. */
  readonly fetchImpl?: OpenAICompatibleClientOptions["fetchImpl"];
}

/**
 * Builds the production interpreter from environment configuration. Defaults
 * (without env overrides) target Grok on `https://api.x.ai/v1`.
 *
 * Throws LLMProviderError at construction when no API key is configured, so
 * misconfiguration fails fast instead of at request time.
 */
export function createLLMDirectiveInterpreter(
  options: CreateLLMDirectiveInterpreterOptions = {}
): LLMDirectiveInterpreter {
  const config = options.config ?? getLLMConfig();

  if (!config.LLM_API_KEY) {
    throw new LLMProviderError(
      "The LLM provider API key is not configured.",
      "LLM_API_KEY must be set before the directive interpreter can call the LLM provider."
    );
  }

  const client = new OpenAICompatibleClient({
    apiKey: config.LLM_API_KEY,
    baseUrl: config.LLM_BASE_URL,
    fetchImpl: options.fetchImpl,
    maxRetries: config.LLM_MAX_RETRIES,
    model: config.LLM_MODEL,
    responseMode: config.LLM_RESPONSE_MODE,
    retryDelayMs: config.LLM_RETRY_DELAY_MS,
    timeoutMs: config.LLM_TIMEOUT,
  });

  return new LLMDirectiveInterpreter({ client });
}
