import type { Scenario } from "../domain/scenario.ts";
import type { DirectiveInterpretation } from "./directive.ts";

const HOURS = 24;

interface MutableDirectives {
  chargeAllowed: boolean[];
  dischargeAllowed: boolean[];
  effectiveSolarFactor: number[];
  maxGridImport: number[];
  minimumReserve: number[];
}

export function baselineDirectives(scenario: Scenario) {
  return {
    charge_allowed: Array.from({ length: HOURS }, () => true),
    discharge_allowed: Array.from({ length: HOURS }, () => true),
    effective_solar_factor: Array.from({ length: HOURS }, () => 1),
    max_grid_import: Array.from(
      { length: HOURS },
      () => Number.POSITIVE_INFINITY
    ),
    minimum_reserve: Array.from(
      { length: HOURS },
      () => scenario.battery.minimum_energy_kwh
    ),
  };
}

export function normalizeDirectives(input: {
  readonly scenario: Scenario;
  readonly interpretations: readonly DirectiveInterpretation[];
}) {
  const { scenario, interpretations } = input;

  const params: MutableDirectives = {
    chargeAllowed: Array.from({ length: HOURS }, () => true),
    dischargeAllowed: Array.from({ length: HOURS }, () => true),
    effectiveSolarFactor: Array.from({ length: HOURS }, () => 1),
    maxGridImport: Array.from(
      { length: HOURS },
      () => Number.POSITIVE_INFINITY
    ),
    minimumReserve: Array.from(
      { length: HOURS },
      () => scenario.battery.minimum_energy_kwh
    ),
  };

  const inWindow = (start: number, end: number, hour: number) =>
    hour >= start && hour < end;

  for (const interpretation of interpretations) {
    const adjustment = interpretation.structured_adjustment;
    if (!interpretation.applies || adjustment === null) {
      continue;
    }

    switch (adjustment.type) {
      case "solar_reduction": {
        const factor = adjustment.effective_solar_factor;
        params.effectiveSolarFactor = params.effectiveSolarFactor.map(
          (value) => value * factor
        );
        break;
      }
      case "minimum_battery_reserve": {
        const reserve = adjustment.minimum_reserve_kwh;
        params.minimumReserve = params.minimumReserve.map((value) =>
          Math.max(value, reserve)
        );
        break;
      }
      case "no_charge_window":
        for (
          let hour = adjustment.hour_start;
          hour < adjustment.hour_end;
          hour += 1
        ) {
          params.chargeAllowed[hour] = false;
        }
        break;
      case "no_discharge_window":
        for (
          let hour = adjustment.hour_start;
          hour < adjustment.hour_end;
          hour += 1
        ) {
          params.dischargeAllowed[hour] = false;
        }
        break;
      case "max_grid_window": {
        const limit = adjustment.max_grid_import_kwh;
        params.maxGridImport = params.maxGridImport.map((value, hour) =>
          inWindow(adjustment.hour_start, adjustment.hour_end, hour)
            ? Math.min(value, limit)
            : value
        );
        break;
      }
      default:
        break;
    }
  }

  return {
    charge_allowed: params.chargeAllowed,
    discharge_allowed: params.dischargeAllowed,
    effective_solar_factor: params.effectiveSolarFactor,
    max_grid_import: params.maxGridImport,
    minimum_reserve: params.minimumReserve,
  };
}
