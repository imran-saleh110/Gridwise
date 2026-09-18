import type { DirectiveInterpretation } from "../domain/directive.ts";
import type { HourlyPlanEntry, OptimizationPlan } from "../domain/plan.ts";
import type { Scenario } from "../domain/scenario.ts";
import { ScheduleValidationError } from "../errors/index.ts";
import type { ScheduleValidator } from "../service/optimize-energy.ts";

const TOLERANCE = 0.01;

interface OperationalConstraints {
  chargeAllowed: boolean[];
  dischargeAllowed: boolean[];
  effectiveSolar: number[];
  maxGridLimits: number[];
  minReserves: number[];
}

function applyDirectiveToConstraints(
  constraints: OperationalConstraints,
  dir: DirectiveInterpretation,
  scenario: Scenario
): void {
  if (!(dir.applies && dir.structured_adjustment)) {
    return;
  }

  switch (dir.directive_type) {
    case "solar_reduction":
      for (const h of dir.structured_adjustment.hours) {
        const baseSolar = scenario.hours[h]?.solar_kwh ?? 0;
        constraints.effectiveSolar[h] =
          baseSolar * dir.structured_adjustment.factor;
      }
      break;
    case "minimum_battery_reserve":
      for (const h of dir.structured_adjustment.hours) {
        constraints.minReserves[h] = Math.max(
          constraints.minReserves[h] ?? 0,
          dir.structured_adjustment.minimum_energy_kwh
        );
      }
      break;
    case "no_charge_window":
      for (const h of dir.structured_adjustment.hours) {
        constraints.chargeAllowed[h] = false;
      }
      break;
    case "no_discharge_window":
      for (const h of dir.structured_adjustment.hours) {
        constraints.dischargeAllowed[h] = false;
      }
      break;
    case "max_grid_window":
      for (const h of dir.structured_adjustment.hours) {
        constraints.maxGridLimits[h] = Math.min(
          constraints.maxGridLimits[h] ?? Number.POSITIVE_INFINITY,
          dir.structured_adjustment.max_grid_kwh
        );
      }
      break;
    default:
      break;
  }
}

function computeEffectiveConstraints(
  scenario: Scenario,
  directives: readonly DirectiveInterpretation[]
): OperationalConstraints {
  const constraints: OperationalConstraints = {
    chargeAllowed: Array.from({ length: 24 }, () => true),
    dischargeAllowed: Array.from({ length: 24 }, () => true),
    effectiveSolar: scenario.hours.map((h) => h.solar_kwh),
    maxGridLimits: Array.from({ length: 24 }, () => Number.POSITIVE_INFINITY),
    minReserves: Array.from(
      { length: 24 },
      () => scenario.battery.minimum_energy_kwh
    ),
  };

  for (const dir of directives) {
    if (dir.applies && dir.structured_adjustment) {
      applyDirectiveToConstraints(constraints, dir, scenario);
    }
  }

  return constraints;
}

function validateHourStructure(hourlyPlan: readonly HourlyPlanEntry[]): void {
  if (hourlyPlan.length !== 24) {
    throw new ScheduleValidationError(
      "Hourly plan must contain exactly 24 entries.",
      `Received ${hourlyPlan.length} hourly plan entries.`
    );
  }

  for (let h = 0; h < 24; h += 1) {
    const entry = hourlyPlan[h];
    if (entry?.hour !== h) {
      throw new ScheduleValidationError(
        `Invalid hourly plan sequence at index ${h}; expected hour ${h}, got ${entry?.hour}.`
      );
    }
  }
}

function validateEnergyBalance(
  hour: number,
  planEntry: HourlyPlanEntry,
  demandKwh: number
): void {
  const chargeKwh =
    planEntry.battery_action === "charge" ? planEntry.battery_kwh : 0;
  const dischargeKwh =
    planEntry.battery_action === "discharge" ? planEntry.battery_kwh : 0;

  const totalGen = planEntry.grid_kwh + planEntry.solar_used_kwh + dischargeKwh;
  const totalLoad = demandKwh + chargeKwh;

  if (Math.abs(totalGen - totalLoad) > TOLERANCE) {
    throw new ScheduleValidationError(
      `Energy balance violation at hour ${hour}: Generation/Inflow (${totalGen.toFixed(2)} kWh) does not match Demand/Outflow (${totalLoad.toFixed(2)} kWh).`
    );
  }
}

function validateSolarLimit(
  hour: number,
  solarUsed: number,
  effectiveSolar: number
): void {
  if (solarUsed < -TOLERANCE) {
    throw new ScheduleValidationError(
      `Negative solar generation used at hour ${hour}: ${solarUsed} kWh.`
    );
  }
  if (solarUsed - effectiveSolar > TOLERANCE) {
    throw new ScheduleValidationError(
      `Solar usage limit exceeded at hour ${hour}: solar_used_kwh (${solarUsed.toFixed(2)} kWh) > effective_solar (${effectiveSolar.toFixed(2)} kWh).`
    );
  }
}

function validateBatteryState(
  hour: number,
  planEntry: HourlyPlanEntry,
  previousEnergy: number,
  battery: Scenario["battery"],
  constraints: OperationalConstraints
): void {
  const chargeKwh =
    planEntry.battery_action === "charge" ? planEntry.battery_kwh : 0;
  const dischargeKwh =
    planEntry.battery_action === "discharge" ? planEntry.battery_kwh : 0;

  if (chargeKwh > battery.max_charge_kwh_per_hour + TOLERANCE) {
    throw new ScheduleValidationError(
      `Max charge rate exceeded at hour ${hour}: ${chargeKwh.toFixed(2)} > max ${battery.max_charge_kwh_per_hour} kWh.`
    );
  }

  if (dischargeKwh > battery.max_discharge_kwh_per_hour + TOLERANCE) {
    throw new ScheduleValidationError(
      `Max discharge rate exceeded at hour ${hour}: ${dischargeKwh.toFixed(2)} > max ${battery.max_discharge_kwh_per_hour} kWh.`
    );
  }

  const expectedEnergyAfter = previousEnergy + chargeKwh - dischargeKwh;
  if (
    Math.abs(planEntry.battery_energy_after_kwh - expectedEnergyAfter) >
    TOLERANCE
  ) {
    throw new ScheduleValidationError(
      `Battery state transition error at hour ${hour}: reported ${planEntry.battery_energy_after_kwh.toFixed(2)} kWh != expected ${expectedEnergyAfter.toFixed(2)} kWh.`
    );
  }

  const minReserve =
    constraints.minReserves[hour] ?? battery.minimum_energy_kwh;
  if (planEntry.battery_energy_after_kwh < minReserve - TOLERANCE) {
    throw new ScheduleValidationError(
      `Battery reserve violated at hour ${hour}: ${planEntry.battery_energy_after_kwh.toFixed(2)} kWh < minimum reserve ${minReserve.toFixed(2)} kWh.`
    );
  }

  if (planEntry.battery_energy_after_kwh > battery.capacity_kwh + TOLERANCE) {
    throw new ScheduleValidationError(
      `Battery storage capacity exceeded at hour ${hour}: ${planEntry.battery_energy_after_kwh.toFixed(2)} kWh > capacity ${battery.capacity_kwh.toFixed(2)} kWh.`
    );
  }

  if (
    !constraints.chargeAllowed[hour] &&
    planEntry.battery_action === "charge" &&
    planEntry.battery_kwh > TOLERANCE
  ) {
    throw new ScheduleValidationError(
      `No-charge directive violated at hour ${hour}: battery charged ${planEntry.battery_kwh.toFixed(2)} kWh during restricted window.`
    );
  }

  if (
    !constraints.dischargeAllowed[hour] &&
    planEntry.battery_action === "discharge" &&
    planEntry.battery_kwh > TOLERANCE
  ) {
    throw new ScheduleValidationError(
      `No-discharge directive violated at hour ${hour}: battery discharged ${planEntry.battery_kwh.toFixed(2)} kWh during restricted window.`
    );
  }

  const maxGrid = constraints.maxGridLimits[hour] ?? Number.POSITIVE_INFINITY;
  if (planEntry.grid_kwh > maxGrid + TOLERANCE) {
    throw new ScheduleValidationError(
      `Max grid limit violated at hour ${hour}: grid import ${planEntry.grid_kwh.toFixed(2)} kWh > cap ${maxGrid.toFixed(2)} kWh.`
    );
  }
}

/**
 * Production schedule validator running 9-gate physical constraint verification.
 */
export class IndependentScheduleValidator implements ScheduleValidator {
  validate(
    scenario: Scenario,
    plan: OptimizationPlan,
    directives: readonly DirectiveInterpretation[]
  ): Promise<OptimizationPlan> {
    validateHourStructure(plan.hourly_plan);

    const constraints = computeEffectiveConstraints(scenario, directives);
    let runningEnergy = scenario.battery.initial_energy_kwh;
    let recalculatedGrid = 0;
    let recalculatedCost = 0;
    let recalculatedPeakGrid = 0;

    for (let h = 0; h < 24; h += 1) {
      const planEntry = plan.hourly_plan[h];
      const hourInput = scenario.hours[h];
      if (!(planEntry && hourInput)) {
        throw new ScheduleValidationError(
          `Missing hourly plan or input entry at hour ${h}.`
        );
      }

      validateEnergyBalance(h, planEntry, hourInput.demand_kwh);
      validateSolarLimit(
        h,
        planEntry.solar_used_kwh,
        constraints.effectiveSolar[h] ?? 0
      );
      validateBatteryState(
        h,
        planEntry,
        runningEnergy,
        scenario.battery,
        constraints
      );

      runningEnergy = planEntry.battery_energy_after_kwh;
      recalculatedGrid += planEntry.grid_kwh;
      recalculatedCost += planEntry.grid_kwh * hourInput.tariff_bdt_per_kwh;
      recalculatedPeakGrid = Math.max(recalculatedPeakGrid, planEntry.grid_kwh);
    }

    // End-of-day neutrality check
    const finalEnergy =
      plan.hourly_plan[23]?.battery_energy_after_kwh ?? runningEnergy;
    if (
      Math.abs(finalEnergy - scenario.battery.initial_energy_kwh) > TOLERANCE
    ) {
      throw new ScheduleValidationError(
        `End-of-day battery neutrality violation: final energy at hour 23 (${finalEnergy.toFixed(2)} kWh) does not match initial energy (${scenario.battery.initial_energy_kwh.toFixed(2)} kWh).`
      );
    }

    // Reconcile and return validated plan
    return Promise.resolve({
      ...plan,
      peak_grid_kwh: Math.round(recalculatedPeakGrid * 100) / 100,
      total_cost_bdt: Math.round(recalculatedCost * 100) / 100,
      total_grid_kwh: Math.round(recalculatedGrid * 100) / 100,
    });
  }
}
