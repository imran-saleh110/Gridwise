import sampleData from "./sample-cases.json" with { type: "json" };
import type { SampleCase } from "./types.ts";

export const SAMPLE_CASES: SampleCase[] = sampleData as unknown as SampleCase[];
