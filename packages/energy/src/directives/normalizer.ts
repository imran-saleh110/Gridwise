import type { DirectiveInterpretation } from "../domain/directive.ts";
import type { Scenario } from "../domain/scenario.ts";
import type { NormalizedDirectives } from "./normalized.ts";

const HOURS = 24;

interface MutableDirectives {
  chargeAllowed: boolean[];
  dischargeAllowed: boolean[];
  effectiveSolarFactor: number[];
  maxGridKwh: number[];
  minimumReserve: number[];
}

function mutableBaseline(scenario: Scenario): MutableDirectives {
  return {
    chargeAllowed: Array.from({ length: HOURS }, () => true),
    dischargeAllowed: Array.from({ length: HOURS }, () => true),
    effectiveSolarFactor: Array.from({ length: HOURS }, () => 1),
    maxGridKwh: Array.from({ length: HOURS }, () => Number.POSITIVE_INFINITY),
    minimumReserve: Array.from(
      { length: HOURS },
      () => scenario.battery.minimum_energy_kwh
    ),
  };
}

function applySolarFactor(
  params: MutableDirectives,
  hours: readonly number[],
  factor: number
): void {
  for (const hour of hours) {
    const current = params.effectiveSolarFactor[hour] ?? 1;
    params.effectiveSolarFactor[hour] = current * factor;
  }
}

function applyReserve(
  params: MutableDirectives,
  hours: readonly number[],
  reserve: number
): void {
  for (const hour of hours) {
    const current = params.minimumReserve[hour] ?? 0;
    params.minimumReserve[hour] = Math.max(current, reserve);
  }
}

function forbid(flags: boolean[], hours: readonly number[]): void {
  for (const hour of hours) {
    flags[hour] = false;
  }
}

function capGrid(
  params: MutableDirectives,
  hours: readonly number[],
  limit: number
): void {
  for (const hour of hours) {
    const current = params.maxGridKwh[hour] ?? Number.POSITIVE_INFINITY;
    params.maxGridKwh[hour] = Math.min(current, limit);
  }
}

export function baselineDirectives(scenario: Scenario): NormalizedDirectives {
  const params = mutableBaseline(scenario);
  return {
    charge_allowed: params.chargeAllowed,
    discharge_allowed: params.dischargeAllowed,
    effective_solar_factor: params.effectiveSolarFactor,
    max_grid_kwh: params.maxGridKwh,
    minimum_reserve: params.minimumReserve,
  };
}

export function normalizeDirectives(input: {
  readonly scenario: Scenario;
  readonly interpretations: readonly DirectiveInterpretation[];
}): NormalizedDirectives {
  const { scenario, interpretations } = input;
  const params = mutableBaseline(scenario);

  for (const interpretation of interpretations) {
    if (
      !interpretation.applies ||
      interpretation.structured_adjustment === null
    ) {
      continue;
    }

    switch (interpretation.directive_type) {
      case "solar_reduction":
        applySolarFactor(
          params,
          interpretation.structured_adjustment.hours,
          interpretation.structured_adjustment.factor
        );
        break;
      case "minimum_battery_reserve":
        applyReserve(
          params,
          interpretation.structured_adjustment.hours,
          interpretation.structured_adjustment.minimum_energy_kwh
        );
        break;
      case "no_charge_window":
        forbid(
          params.chargeAllowed,
          interpretation.structured_adjustment.hours
        );
        break;
      case "no_discharge_window":
        forbid(
          params.dischargeAllowed,
          interpretation.structured_adjustment.hours
        );
        break;
      case "max_grid_window":
        capGrid(
          params,
          interpretation.structured_adjustment.hours,
          interpretation.structured_adjustment.max_grid_kwh
        );
        break;
      default:
        break;
    }
  }

  return {
    charge_allowed: params.chargeAllowed,
    discharge_allowed: params.dischargeAllowed,
    effective_solar_factor: params.effectiveSolarFactor,
    max_grid_kwh: params.maxGridKwh,
    minimum_reserve: params.minimumReserve,
  };
}
