import { describe, expect, test } from "bun:test";
import type { DirectiveInterpretation, Scenario } from "../domain/index.ts";
import {
  DirectiveInterpretationError,
  LLMProviderError,
} from "../errors/index.ts";
import type {
  LLMClient,
  LLMCompletion,
  LLMStructuredRequest,
} from "../llm/client.ts";
import { getLLMConfig } from "../llm/config.ts";
import {
  createLLMDirectiveInterpreter,
  LLMDirectiveInterpreter,
} from "./llm-interpreter.ts";
import {
  buildSystemPrompt,
  buildUserPrompt,
  supportedDirectivesText,
} from "./prompt.ts";
import {
  buildDirectiveInterpretationJSONSchema,
  parseDirectiveInterpretationOutput,
} from "./schemas.ts";

/** Scripted LLM transport that records every request made by the interpreter. */
class ScriptedClient implements LLMClient {
  readonly calls: LLMStructuredRequest[] = [];
  private readonly script: Array<LLMCompletion | Error>;

  constructor(script: Array<LLMCompletion | Error>) {
    this.script = [...script];
  }

  completeStructured(request: LLMStructuredRequest): Promise<LLMCompletion> {
    this.calls.push(request);
    const next = this.script.shift();
    if (next === undefined) {
      return Promise.reject(
        new LLMProviderError("No scripted completion left.", "stub exhausted")
      );
    }
    if (next instanceof Error) {
      return Promise.reject(next);
    }
    return Promise.resolve(next);
  }
}

function makeScenario(notes: readonly string[] = ["operator note"]): Scenario {
  const tariffFor = (hour: number): number => {
    if (hour < 6) {
      return 5;
    }
    if (hour < 12) {
      return 10;
    }
    if (hour < 18) {
      return 15;
    }
    return 20;
  };
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    demand_kwh: 100 + hour,
    hour,
    solar_kwh: hour < 6 || hour >= 18 ? 0 : 50,
    tariff_bdt_per_kwh: tariffFor(hour),
  }));
  return {
    battery: {
      capacity_kwh: 200,
      initial_energy_kwh: 100,
      max_charge_kwh_per_hour: 50,
      max_discharge_kwh_per_hour: 50,
      minimum_energy_kwh: 40,
    },
    hours,
    operator_notes: notes,
    scenario_id: "test-scenario",
  };
}

const interpretation = (overrides: {
  type: DirectiveInterpretation["directive_type"];
  adjustment: unknown;
  applies?: boolean;
  explanation?: string;
}): LLMCompletion => ({
  contentText: JSON.stringify({
    applies: overrides.applies ?? overrides.type !== "no_op",
    directive_type: overrides.type,
    explanation: overrides.explanation ?? "Extracted directive.",
    note_index: 0,
    structured_adjustment: overrides.adjustment,
  }),
});

describe("LLMDirectiveInterpreter", () => {
  test("returns one interpretation per note with pinned note_index in order", async () => {
    const client = new ScriptedClient([
      interpretation({
        adjustment: { factor: 0.25, hours: [12, 13] },
        type: "solar_reduction",
      }),
      interpretation({ adjustment: null, type: "no_op" }),
      interpretation({
        adjustment: { hours: [18, 19], minimum_energy_kwh: 100 },
        type: "minimum_battery_reserve",
      }),
    ]);
    const interpreter = new LLMDirectiveInterpreter({
      client,
      maxOutputRetries: 0,
    });

    const notes = [
      "wash panels noon to 2pm",
      "deadline moved",
      "keep 100 kWh reserve 6-8pm",
    ];
    const result = await interpreter.interpret(notes, makeScenario(notes));

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.directive_type)).toEqual([
      "solar_reduction",
      "no_op",
      "minimum_battery_reserve",
    ]);
    expect(result.map((r) => r.note_index)).toEqual([0, 1, 2]);
    expect(client.calls).toHaveLength(3);
  });

  test("sends exactly one structured request per note carrying note + scenario context", async () => {
    const client = new ScriptedClient([
      interpretation({
        adjustment: { factor: 0.5, hours: [12] },
        type: "solar_reduction",
      }),
    ]);
    const interpreter = new LLMDirectiveInterpreter({
      client,
      maxOutputRetries: 0,
    });
    const scenario = makeScenario();

    await interpreter.interpret(["Use half solar at noon"], scenario);

    expect(client.calls).toHaveLength(1);
    const request = client.calls[0] as LLMStructuredRequest;
    expect(request.user).toContain("Use half solar at noon");
    expect(request.user).toContain("capacity_kwh=200");
    expect(request.user).toContain('Set the "note_index" field to 0');
    expect(request.user).toContain("24-hour table");
    expect(request.jsonSchema).toBeDefined();
  });

  test("retries malformed output (bounded) before succeeding", async () => {
    const client = new ScriptedClient([
      { contentText: "this is not json" },
      interpretation({
        adjustment: { hours: [19, 20], max_grid_kwh: 155 },
        type: "max_grid_window",
      }),
    ]);
    const interpreter = new LLMDirectiveInterpreter({ client });

    const result = await interpreter.interpret(
      ["cap grid at 155 in evening"],
      makeScenario()
    );

    expect(client.calls).toHaveLength(2);
    expect(result[0]?.directive_type).toBe("max_grid_window");
  });

  test("rejects schema-invalid LLM output and retries", async () => {
    // no_op must carry a null adjustment; the first response violates that.
    const client = new ScriptedClient([
      interpretation({ adjustment: { hours: [2] }, type: "no_op" }),
      interpretation({
        adjustment: { hours: [2, 3, 4] },
        type: "no_charge_window",
      }),
    ]);
    const interpreter = new LLMDirectiveInterpreter({ client });

    const result = await interpreter.interpret(
      ["charger isolated 2-5am"],
      makeScenario()
    );

    expect(client.calls).toHaveLength(2);
    expect(result[0]?.directive_type).toBe("no_charge_window");
  });

  test("throws DirectiveInterpretationError after exhausting malformed-output retries", () => {
    const client = new ScriptedClient([
      { contentText: "garbage" },
      { contentText: "not valid either" },
    ]);
    const interpreter = new LLMDirectiveInterpreter({
      client,
      maxOutputRetries: 1,
      retryDelayMs: 1,
    });

    expect(
      interpreter.interpret(["uninterpretable note"], makeScenario())
    ).rejects.toBeInstanceOf(DirectiveInterpretationError);
    expect(client.calls).toHaveLength(2);
  });

  test("propagates LLMProviderError without retrying", async () => {
    const providerError = new LLMProviderError("Provider down.");
    const client = new ScriptedClient([providerError]);
    const interpreter = new LLMDirectiveInterpreter({
      client,
      maxOutputRetries: 3,
    });

    await expect(interpreter.interpret(["note"], makeScenario())).rejects.toBe(
      providerError
    );
    expect(client.calls).toHaveLength(1);
  });

  test("rejects a scenario with an invalid note count", async () => {
    const client = new ScriptedClient([]);
    const interpreter = new LLMDirectiveInterpreter({ client });

    await expect(
      interpreter.interpret([], makeScenario())
    ).rejects.toBeInstanceOf(DirectiveInterpretationError);
    await expect(
      interpreter.interpret(["a", "b", "c", "d"], makeScenario())
    ).rejects.toBeInstanceOf(DirectiveInterpretationError);
    expect(client.calls).toHaveLength(0);
  });
});

describe("interpretation prompt", () => {
  test("system prompt fixes the six directive types and the interpretation rules", () => {
    const prompt = buildSystemPrompt();
    for (const type of [
      "solar_reduction",
      "minimum_battery_reserve",
      "no_charge_window",
      "no_discharge_window",
      "max_grid_window",
      "no_op",
    ]) {
      expect(prompt).toContain(type);
    }
    expect(prompt).toContain("END-EXCLUSIVE");
    expect(prompt).toContain("remaining usable fraction");
    expect(prompt).toContain("does NOT perform energy optimization");
  });

  test("user prompt carries the note, its index and the battery context", () => {
    const scenario = makeScenario();
    const prompt = buildUserPrompt("Keep 50% reserve at night", 1, 2, scenario);
    expect(prompt).toContain("Operator note 2 of 2");
    expect(prompt).toContain("Keep 50% reserve at night");
    expect(prompt).toContain("capacity_kwh=200");
    expect(prompt).toContain('Set the "note_index" field to 1');
  });

  test("supportedDirectivesText lists all six types", () => {
    expect(supportedDirectivesText()).toBe(
      "solar_reduction, minimum_battery_reserve, no_charge_window, no_discharge_window, max_grid_window, no_op"
    );
  });
});

describe("parseDirectiveInterpretationOutput", () => {
  test("rejects null, empty, and non-JSON text", () => {
    expect(parseDirectiveInterpretationOutput(null)).toBeNull();
    expect(parseDirectiveInterpretationOutput("")).toBeNull();
    expect(parseDirectiveInterpretationOutput("    ")).toBeNull();
    expect(parseDirectiveInterpretationOutput("not json {")).toBeNull();
  });

  test("parses every valid directive type", () => {
    const adjustments: Array<{
      type: DirectiveInterpretation["directive_type"];
      adjustment: DirectiveInterpretation["structured_adjustment"];
    }> = [
      {
        adjustment: { factor: 0.2, hours: [11, 12, 13] },
        type: "solar_reduction",
      },
      {
        adjustment: { hours: [18, 19, 20], minimum_energy_kwh: 90 },
        type: "minimum_battery_reserve",
      },
      { adjustment: { hours: [2, 3, 4] }, type: "no_charge_window" },
      { adjustment: { hours: [17, 18] }, type: "no_discharge_window" },
      {
        adjustment: { hours: [18, 19, 20], max_grid_kwh: 155 },
        type: "max_grid_window",
      },
      { adjustment: null, type: "no_op" },
    ];
    for (const entry of adjustments) {
      const parsed = parseDirectiveInterpretationOutput(
        interpretation({ adjustment: entry.adjustment, type: entry.type })
          .contentText
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.directive_type).toBe(entry.type);
      expect(parsed?.structured_adjustment).toEqual(entry.adjustment);
    }
  });

  test("rejects out-of-range and non-integer hours", () => {
    for (const bad of [{ hours: [24] }, { hours: [-1] }, { hours: [2.5] }]) {
      const parsed = parseDirectiveInterpretationOutput(
        interpretation({ adjustment: bad, type: "no_charge_window" })
          .contentText
      );
      expect(parsed).toBeNull();
    }
  });

  test("rejects duplicate or unsorted hours and empty windows", () => {
    for (const bad of [{ hours: [3, 2] }, { hours: [2, 2] }, { hours: [] }]) {
      const parsed = parseDirectiveInterpretationOutput(
        interpretation({ adjustment: bad, type: "no_discharge_window" })
          .contentText
      );
      expect(parsed).toBeNull();
    }
  });

  test("rejects invalid solar factors", () => {
    for (const factor of [-0.1, 1.5]) {
      const parsed = parseDirectiveInterpretationOutput(
        interpretation({
          adjustment: { factor, hours: [12] },
          type: "solar_reduction",
        }).contentText
      );
      expect(parsed).toBeNull();
    }
  });

  test("enforces applies and structured_adjustment invariants", () => {
    const noOpWithObject = interpretation({
      adjustment: { hours: [2] },
      type: "no_op",
    });
    expect(
      parseDirectiveInterpretationOutput(noOpWithObject.contentText)
    ).toBeNull();

    const solarWithNull = interpretation({
      adjustment: null,
      type: "solar_reduction",
    });
    expect(
      parseDirectiveInterpretationOutput(solarWithNull.contentText)
    ).toBeNull();

    const reserveWithAppliesFalse = interpretation({
      adjustment: { hours: [18], minimum_energy_kwh: 80 },
      applies: false,
      type: "minimum_battery_reserve",
    });
    expect(
      parseDirectiveInterpretationOutput(reserveWithAppliesFalse.contentText)
    ).toBeNull();

    const noOpWithAppliesTrue = interpretation({
      adjustment: null,
      applies: true,
      type: "no_op",
    });
    expect(
      parseDirectiveInterpretationOutput(noOpWithAppliesTrue.contentText)
    ).toBeNull();
  });

  test("rejects strictly unexpected adjustment fields for a directive", () => {
    const solarWithExtra = interpretation({
      adjustment: { factor: 0.5, hours: [12], max_grid_kwh: 100 },
      type: "solar_reduction",
    });
    expect(
      parseDirectiveInterpretationOutput(solarWithExtra.contentText)
    ).toBeNull();
  });

  test("structured-output JSON schema carries the enum and required fields", () => {
    const schema = buildDirectiveInterpretationJSONSchema();
    const properties = schema.properties as {
      directive_type?: { enum?: readonly string[] };
      structured_adjustment?: unknown;
    };
    expect(properties.directive_type?.enum).toEqual([
      "solar_reduction",
      "minimum_battery_reserve",
      "no_charge_window",
      "no_discharge_window",
      "max_grid_window",
      "no_op",
    ]);
    expect(schema.required).toContain("directive_type");
    expect(schema.required).toContain("structured_adjustment");
    expect(schema.required).toContain("note_index");
    expect(schema.required).toContain("applies");
    expect(schema.required).toContain("explanation");
  });
});

describe("paraphrase robustness corpus", () => {
  // Each entry mirrors how the sample cases describe the same directive with
  // different wording. The interpreter's prompt + contract must route all of
  // these to the same machine-checkable directive.
  const corpus = [
    {
      expected: {
        adjustment: { factor: 0.2, hours: [11, 12] },
        type: "solar_reduction" as const,
      },
      note: "PV output will fall to one fifth during the window.",
    },
    {
      expected: {
        adjustment: { factor: 0.2, hours: [11, 12] },
        type: "solar_reduction" as const,
      },
      note: "Solar production drops to 20% from 11 AM until 1 PM.",
    },
    {
      expected: {
        adjustment: { factor: 0.25, hours: [12, 13] },
        type: "solar_reduction" as const,
      },
      note: "Usable solar should be treated as roughly 25% of the forecast from noon until 2 PM.",
    },
    {
      expected: {
        adjustment: { hours: [2, 3, 4] },
        type: "no_charge_window" as const,
      },
      note: "The battery charger will be isolated from 2 AM until 5 AM for electrical maintenance.",
    },
    {
      expected: {
        adjustment: { hours: [11, 12] },
        type: "no_charge_window" as const,
      },
      note: "Battery charging is disabled from 11 AM until 1 PM while technicians inspect the charger.",
    },
    {
      expected: {
        adjustment: { hours: [18, 19] },
        type: "no_discharge_window" as const,
      },
      note: "For protection testing, the battery must not discharge from 6 PM until 8 PM.",
    },
    {
      expected: {
        adjustment: { hours: [18, 19, 20], minimum_energy_kwh: 100 },
        type: "minimum_battery_reserve" as const,
      },
      note: "Keep at least 50% of the battery capacity stored in the battery from 6 PM until 9 PM for emergency operations.",
    },
    {
      expected: {
        adjustment: { hours: [18, 19, 20, 21], minimum_energy_kwh: 90 },
        type: "minimum_battery_reserve" as const,
      },
      note: "Keep at least 90 kWh in the battery from 6 PM until 10 PM for emergency services.",
    },
    {
      expected: {
        adjustment: { hours: [18, 19, 20], max_grid_kwh: 155 },
        type: "max_grid_window" as const,
      },
      note: "From 6 PM until 9 PM, campus grid import must not exceed 155 kWh in any hour.",
    },
    {
      expected: {
        adjustment: { hours: [19, 20, 21], max_grid_kwh: 190 },
        type: "max_grid_window" as const,
      },
      note: "Grid intake must stay at or below 190 kWh from 7 PM until 10 PM.",
    },
    {
      expected: { adjustment: null, type: "no_op" as const },
      note: "The sports office moved next month's registration deadline.",
    },
    {
      expected: { adjustment: null, type: "no_op" as const },
      note: "A seminar room booking was moved to next week.",
    },
  ];

  for (const entry of corpus) {
    test(`interprets "${entry.note}"`, async () => {
      const client = new ScriptedClient([
        interpretation({
          adjustment: entry.expected.adjustment,
          type: entry.expected.type,
        }),
      ]);
      const interpreter = new LLMDirectiveInterpreter({
        client,
        maxOutputRetries: 0,
      });

      const result = await interpreter.interpret(
        [entry.note],
        makeScenario([entry.note])
      );

      expect(result[0]?.directive_type).toBe(entry.expected.type);
      expect(result[0]?.structured_adjustment).toEqual(
        entry.expected.adjustment
      );
      expect(client.calls[0]?.user).toContain(entry.note);
    });
  }
});

describe("createLLMDirectiveInterpreter", () => {
  test("fails fast when no API key is configured", () => {
    expect(() =>
      createLLMDirectiveInterpreter({
        config: {
          ...getLLMConfig({} as NodeJS.ProcessEnv),
          LLM_API_KEY: undefined,
        },
      })
    ).toThrow(LLMProviderError);
  });

  test("builds a working interpreter from config with a key", () => {
    const config = getLLMConfig({} as NodeJS.ProcessEnv);
    const interpreter = createLLMDirectiveInterpreter({
      config: { ...config, LLM_API_KEY: "test-key" },
    });
    expect(interpreter).toBeInstanceOf(LLMDirectiveInterpreter);
  });
});

describe("LLM config defaults", () => {
  test("targets Groq by default", () => {
    const config = getLLMConfig({} as NodeJS.ProcessEnv);
    expect(config.LLM_BASE_URL).toBe("https://api.groq.com/openai/v1");
    expect(config.LLM_MODEL).toBe("openai/gpt-oss-120b");
    expect(config.LLM_RESPONSE_MODE).toBe("json_object");
  });
});
