import { LLMProviderError } from "../errors/index.ts";

/**
 * Transport-level client for an OpenAI-compatible Chat Completions API.
 *
 * Responsible for:
 *   - building the request (model, messages, temperature, structured output)
 *   - per-request timeout
 *   - bounded retries with exponential backoff on network / 5xx / 429 failures
 *   - extracting the raw completion text (JSON parsing stays with the caller so
 *     that "malformed structured output" is retried at the interpreter level)
 *
 * The implementation is injected with `fetch` so tests run against a fake
 * transport with no network access.
 */

export type StructuredOutputMode = "json_schema" | "json_object";

export interface LLMStructuredRequest {
  /**
   * JSON Schema describing the structured output. Only used when the client is
   * configured with `responseMode: "json_schema"`.
   */
  readonly jsonSchema: Record<string, unknown>;
  /** System prompt (directive interpretation rules). */
  readonly system: string;
  /** User prompt (the single operator note to interpret, with context). */
  readonly user: string;
}

export interface LLMCompletion {
  /** Raw text returned by the model, or null when the provider returned no text. */
  readonly contentText: string | null;
}

/** Schema-driven structured completion. Implementations must be mockable. */
export interface LLMClient {
  completeStructured: (request: LLMStructuredRequest) => Promise<LLMCompletion>;
}

export interface OpenAICompatibleClientOptions {
  /** Provider API key. Never logged or returned to clients. */
  readonly apiKey: string;
  /** Base URL of the OpenAI-compatible API, e.g. https://api.openai.com/v1 */
  readonly baseUrl?: string;
  /** Injectable fetch implementation (for tests). Defaults to global fetch. */
  readonly fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  /** Maximum transport-level retries. Defaults to 2. */
  readonly maxRetries?: number;
  /** Model identifier. */
  readonly model: string;
  /** Structured-output strategy. Defaults to json_schema. */
  readonly responseMode?: StructuredOutputMode;
  /** Base backoff delay in ms, doubled after each retry. Defaults to 500ms. */
  readonly retryDelayMs?: number;
  /** Per-request timeout in milliseconds. Defaults to 15s. */
  readonly timeoutMs?: number;
}

const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const TRAILING_SLASHES = /\/+$/;

interface LlmTransportErrorOptions extends ErrorOptions {
  readonly retryable?: boolean;
  readonly status?: number;
}

/** Internal transport error used to decide whether to retry. Never escapes the client. */
class LlmTransportError extends Error {
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(message: string, options: LlmTransportErrorOptions = {}) {
    super(message, options);
    this.name = "LlmTransportError";
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Extracts the completion text from a Chat Completions response envelope. */
export function extractCompletionText(responseBody: unknown): string | null {
  if (typeof responseBody !== "object" || responseBody === null) {
    return null;
  }

  const { choices } = responseBody as { choices?: unknown };
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const [firstChoice] = choices;
  if (typeof firstChoice !== "object" || firstChoice === null) {
    return null;
  }

  const { message } = firstChoice as { message?: unknown };
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const { content } = message as { content?: unknown };
  return typeof content === "string" ? content : null;
}

export class OpenAICompatibleClient implements LLMClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly responseMode: StructuredOutputMode;
  private readonly fetchImpl: (
    url: string,
    init: RequestInit
  ) => Promise<Response>;

  constructor(options: OpenAICompatibleClientOptions) {
    if (!options.apiKey) {
      throw new LLMProviderError(
        "The LLM provider API key is not configured.",
        "LLM_API_KEY must be set before the directive interpreter can call the LLM provider."
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(
      TRAILING_SLASHES,
      ""
    );
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.responseMode = options.responseMode ?? "json_schema";
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  }

  async completeStructured(
    request: LLMStructuredRequest
  ): Promise<LLMCompletion> {
    let completion: LLMCompletion | undefined;
    let lastError: LlmTransportError | undefined;
    let attempt = 0;

    const attemptSend = async (): Promise<void> => {
      try {
        completion = await this.sendOnce(request);
      } catch (err: unknown) {
        if (!(err instanceof LlmTransportError && err.retryable)) {
          throw err;
        }
        lastError = err;
        if (attempt >= this.maxRetries) {
          return;
        }
        attempt += 1;
        await sleep(this.retryDelayMs * 2 ** (attempt - 1));
        return attemptSend();
      }
    };

    await attemptSend();

    if (completion !== undefined) {
      return completion;
    }

    throw new LLMProviderError(
      "The language model provider is temporarily unavailable.",
      lastError === undefined
        ? "LLM request failed after all retries."
        : `LLM request failed after ${this.maxRetries + 1} attempts (${lastError.message}).`
    );
  }

  private async sendOnce(
    request: LLMStructuredRequest
  ): Promise<LLMCompletion> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const responseFormat =
      this.responseMode === "json_schema"
        ? {
            json_schema: {
              name: "directive_interpretation",
              schema: request.jsonSchema,
              strict: true,
            },
            type: "json_schema",
          }
        : { type: "json_object" };

    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/chat/completions`,
        {
          body: JSON.stringify({
            messages: [
              { content: request.system, role: "system" },
              { content: request.user, role: "user" },
            ],
            model: this.model,
            response_format: responseFormat,
            temperature: 0,
          }),
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const message = `LLM provider returned HTTP ${response.status}.`;
        throw new LlmTransportError(message, {
          retryable: RETRYABLE_HTTP_STATUS.has(response.status),
          status: response.status,
        });
      }

      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch (err: unknown) {
        throw new LlmTransportError(
          "LLM provider returned a non-JSON response body.",
          { cause: err, retryable: true, status: response.status }
        );
      }

      return { contentText: extractCompletionText(responseBody) };
    } catch (err: unknown) {
      if (err instanceof LlmTransportError) {
        throw err;
      }
      throw new LlmTransportError(
        "Network failure or request timeout while calling the LLM provider.",
        { cause: err, retryable: true }
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
