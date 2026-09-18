import type {
  BatteryConfig,
  DirectiveInterpretation,
  HourInput,
  HourlyPlanItem,
  MaxGridWindowAdjustment,
  MinimumBatteryReserveAdjustment,
  OptimizationResponse,
  ScenarioInput,
  ScheduleValidationReport,
  SolarReductionAdjustment,
  ValidationCheckItem,
} from "./types.ts";

const TOLERANCE = 0.01;

interface OperationalConstraints {
  chargeAllowed: boolean[];
  dischargeAllowed: boolean[];
  effectiveSolarFactors: number[];
  maxGridLimits: number[];
  minReserves: number[];
}

function applySolarReduction(
  adj: SolarReductionAdjustment,
  constraints: OperationalConstraints
) {
  if (typeof adj.factor !== "number" || !Array.isArray(adj.hours)) {
    return;
  }
  for (const h of adj.hours) {
    if (h >= 0 && h < 24) {
      constraints.effectiveSolarFactors[h] *= adj.factor;
    }
  }
}

function applyReserve(
  adj: MinimumBatteryReserveAdjustment,
  battery: BatteryConfig,
  constraints: OperationalConstraints
) {
  if (!Array.isArray(adj.hours)) {
    return;
  }
  const reserveVal =
    adj.reserve_kwh ?? adj.minimum_energy_kwh ?? battery.minimum_energy_kwh;
  for (const h of adj.hours) {
    if (h >= 0 && h < 24) {
      constraints.minReserves[h] = Math.max(
        constraints.minReserves[h],
        reserveVal
      );
    }
  }
}

function applyNoCharge(hours: number[], constraints: OperationalConstraints) {
  if (!Array.isArray(hours)) {
    return;
  }
  for (const h of hours) {
    if (h >= 0 && h < 24) {
      constraints.chargeAllowed[h] = false;
    }
  }
}

function applyNoDischarge(
  hours: number[],
  constraints: OperationalConstraints
) {
  if (!Array.isArray(hours)) {
    return;
  }
  for (const h of hours) {
    if (h >= 0 && h < 24) {
      constraints.dischargeAllowed[h] = false;
    }
  }
}

function applyMaxGrid(
  adj: MaxGridWindowAdjustment,
  constraints: OperationalConstraints
) {
  if (typeof adj.max_grid_kwh !== "number" || !Array.isArray(adj.hours)) {
    return;
  }
  for (const h of adj.hours) {
    if (h >= 0 && h < 24) {
      constraints.maxGridLimits[h] = Math.min(
        constraints.maxGridLimits[h],
        adj.max_grid_kwh
      );
    }
  }
}

function applyDirective(
  interp: DirectiveInterpretation,
  battery: BatteryConfig,
  constraints: OperationalConstraints
) {
  if (!(interp.applies && interp.structured_adjustment)) {
    return;
  }
  const adj = interp.structured_adjustment;

  if (interp.directive_type === "solar_reduction") {
    applySolarReduction(adj as SolarReductionAdjustment, constraints);
  } else if (interp.directive_type === "minimum_battery_reserve") {
    applyReserve(adj as MinimumBatteryReserveAdjustment, battery, constraints);
  } else if (interp.directive_type === "no_charge_window") {
    applyNoCharge(adj.hours, constraints);
  } else if (interp.directive_type === "no_discharge_window") {
    applyNoDischarge(adj.hours, constraints);
  } else if (interp.directive_type === "max_grid_window") {
    applyMaxGrid(adj as MaxGridWindowAdjustment, constraints);
  }
}

function buildOperationalConstraints(
  battery: BatteryConfig,
  directives: DirectiveInterpretation[]
): OperationalConstraints {
  const constraints: OperationalConstraints = {
    chargeAllowed: new Array(24).fill(true),
    dischargeAllowed: new Array(24).fill(true),
    effectiveSolarFactors: new Array(24).fill(1.0),
    maxGridLimits: new Array(24).fill(Number.POSITIVE_INFINITY),
    minReserves: new Array(24).fill(battery.minimum_energy_kwh),
  };

  if (Array.isArray(directives)) {
    for (const interp of directives) {
      applyDirective(interp, battery, constraints);
    }
  }

  return constraints;
}

function checkEnergyBalance(
  hours: HourInput[],
  hourlyPlan: HourlyPlanItem[],
  errors: string[]
): ValidationCheckItem {
  let passed = true;
  for (let h = 0; h < 24; h += 1) {
    const demand = hours[h]?.demand_kwh ?? 0;
    const planHour = hourlyPlan[h];
    const grid = planHour.grid_kwh;
    const solarUsed = planHour.solar_used_kwh;
    const batteryCharge =
      planHour.battery_action === "charge" ? planHour.battery_kwh : 0;
    const batteryDischarge =
      planHour.battery_action === "discharge" ? planHour.battery_kwh : 0;

    const generation = grid + solarUsed + batteryDischarge;
    const consumption = demand + batteryCharge;

    if (Math.abs(generation - consumption) > TOLERANCE) {
      passed = false;
      errors.push(
        `Hour ${h}: Energy balance violation (Gen=${generation.toFixed(2)} kWh != Load=${consumption.toFixed(2)} kWh).`
      );
    }
  }

  return {
    details: passed
      ? "All 24 hours satisfy the exact energy conservation law."
      : "Energy conservation violated in one or more hours.",
    id: "energy-balance",
    name: "Hourly Energy Balance (Grid + Solar + Discharge = Demand + Charge)",
    passed,
  };
}

function checkSolarLimits(
  hours: HourInput[],
  hourlyPlan: HourlyPlanItem[],
  effectiveFactors: number[],
  errors: string[]
): ValidationCheckItem {
  let passed = true;
  for (let h = 0; h < 24; h += 1) {
    const rawSolar = hours[h]?.solar_kwh ?? 0;
    const effectiveSolar = rawSolar * effectiveFactors[h];
    const solarUsed = hourlyPlan[h].solar_used_kwh;

    if (solarUsed < -TOLERANCE || solarUsed > effectiveSolar + TOLERANCE) {
      passed = false;
      errors.push(
        `Hour ${h}: Solar used (${solarUsed} kWh) outside effective solar (${effectiveSolar.toFixed(2)} kWh).`
      );
    }
  }

  return {
    details: passed
      ? "Solar consumption is within available and derated forecasts."
      : "Solar used exceeded allowable generation.",
    id: "solar-limit",
    name: "Effective Solar Availability Limits",
    passed,
  };
}

function checkBatteryRates(
  battery: BatteryConfig,
  hourlyPlan: HourlyPlanItem[],
  errors: string[]
): ValidationCheckItem {
  let passed = true;
  for (let h = 0; h < 24; h += 1) {
    const item = hourlyPlan[h];
    if (item.battery_kwh < -TOLERANCE) {
      passed = false;
      errors.push(`Hour ${h}: Negative battery kWh (${item.battery_kwh}).`);
    } else if (
      item.battery_action === "charge" &&
      item.battery_kwh > battery.max_charge_kwh_per_hour + TOLERANCE
    ) {
      passed = false;
      errors.push(
        `Hour ${h}: Charge rate (${item.battery_kwh} kW) exceeds limit (${battery.max_charge_kwh_per_hour} kW).`
      );
    } else if (
      item.battery_action === "discharge" &&
      item.battery_kwh > battery.max_discharge_kwh_per_hour + TOLERANCE
    ) {
      passed = false;
      errors.push(
        `Hour ${h}: Discharge rate (${item.battery_kwh} kW) exceeds limit (${battery.max_discharge_kwh_per_hour} kW).`
      );
    } else if (item.battery_action === "idle" && item.battery_kwh > TOLERANCE) {
      passed = false;
      errors.push(
        `Hour ${h}: Idle battery has non-zero power (${item.battery_kwh}).`
      );
    }
  }

  return {
    details: passed
      ? `Within limits (Max Charge: ${battery.max_charge_kwh_per_hour} kW, Max Discharge: ${battery.max_discharge_kwh_per_hour} kW).`
      : "Battery charge or discharge rate exceeded hourly limits.",
    id: "battery-rates",
    name: "Battery Charge & Discharge Rate Constraints",
    passed,
  };
}

function checkBatteryTransitions(
  battery: BatteryConfig,
  hourlyPlan: HourlyPlanItem[],
  minReserves: number[],
  errors: string[]
): [ValidationCheckItem, ValidationCheckItem] {
  let transitionPassed = true;
  let boundsPassed = true;

  for (let h = 0; h < 24; h += 1) {
    const prev =
      h === 0
        ? battery.initial_energy_kwh
        : hourlyPlan[h - 1].battery_energy_after_kwh;
    const item = hourlyPlan[h];
    const chg = item.battery_action === "charge" ? item.battery_kwh : 0;
    const dis = item.battery_action === "discharge" ? item.battery_kwh : 0;
    const expected = prev + chg - dis;

    if (Math.abs(expected - item.battery_energy_after_kwh) > TOLERANCE) {
      transitionPassed = false;
      errors.push(
        `Hour ${h}: State transition error (Expected=${expected.toFixed(2)}, Actual=${item.battery_energy_after_kwh}).`
      );
    }

    if (item.battery_energy_after_kwh > battery.capacity_kwh + TOLERANCE) {
      boundsPassed = false;
      errors.push(
        `Hour ${h}: Energy (${item.battery_energy_after_kwh} kWh) exceeds capacity (${battery.capacity_kwh} kWh).`
      );
    }

    if (item.battery_energy_after_kwh < minReserves[h] - TOLERANCE) {
      boundsPassed = false;
      errors.push(
        `Hour ${h}: Energy (${item.battery_energy_after_kwh} kWh) below reserve floor (${minReserves[h]} kWh).`
      );
    }
  }

  return [
    {
      details: transitionPassed
        ? "All state of charge transitions are physically consistent."
        : "State of charge transitions do not match charge/discharge delta.",
      id: "battery-transition",
      name: "Battery Energy State Transitions",
      passed: transitionPassed,
    },
    {
      details: boundsPassed
        ? `Energy stays strictly within [${battery.minimum_energy_kwh} kWh, ${battery.capacity_kwh} kWh] and reserve floors.`
        : "Battery stored energy violated capacity ceiling or reserve floor.",
      id: "battery-bounds",
      name: "Battery Capacity & Reserve Floor Limits",
      passed: boundsPassed,
    },
  ];
}

function checkDirectiveWindows(
  hourlyPlan: HourlyPlanItem[],
  constraints: OperationalConstraints,
  errors: string[]
): ValidationCheckItem {
  let passed = true;
  for (let h = 0; h < 24; h += 1) {
    const item = hourlyPlan[h];
    if (
      !constraints.chargeAllowed[h] &&
      item.battery_action === "charge" &&
      item.battery_kwh > TOLERANCE
    ) {
      passed = false;
      errors.push(`Hour ${h}: Battery charged during no-charge window.`);
    }

    if (
      !constraints.dischargeAllowed[h] &&
      item.battery_action === "discharge" &&
      item.battery_kwh > TOLERANCE
    ) {
      passed = false;
      errors.push(`Hour ${h}: Battery discharged during no-discharge window.`);
    }

    if (item.grid_kwh > constraints.maxGridLimits[h] + TOLERANCE) {
      passed = false;
      errors.push(
        `Hour ${h}: Grid import (${item.grid_kwh} kW) exceeds cap (${constraints.maxGridLimits[h]} kW).`
      );
    }
  }

  return {
    details: passed
      ? "All operator directives and windows are strictly enforced."
      : "One or more operational window directives were breached.",
    id: "directive-constraints",
    name: "Operator Window Constraints (No-Charge / No-Discharge / Grid Caps)",
    passed,
  };
}

export function validateSchedule(
  scenario: ScenarioInput,
  response: OptimizationResponse
): ScheduleValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks: ValidationCheckItem[] = [];

  const { hours, battery } = scenario;
  const { hourly_plan, directive_interpretation } = response;

  // 1. Structure Check
  const has24 = hourly_plan.length === 24;
  const isSeq = has24 && hourly_plan.every((item, idx) => item.hour === idx);

  checks.push({
    details:
      has24 && isSeq
        ? "Plan spans exactly 24 sequential hours (00:00 to 23:00)."
        : "Schedule structure is invalid or incomplete.",
    id: "structure",
    name: "24-Hour Horizon Structure",
    passed: has24 && isSeq,
  });

  if (!(has24 && isSeq)) {
    errors.push("Invalid 24-hour structure.");
    return {
      checks,
      errors,
      isValid: false,
      recalculated: { peakGrid: 0, totalCost: 0, totalGrid: 0 },
      toleranceDelta: { costDelta: 0, gridDelta: 0, peakDelta: 0 },
      warnings,
    };
  }

  const constraints = buildOperationalConstraints(
    battery,
    directive_interpretation
  );

  // 2. Energy Balance
  checks.push(checkEnergyBalance(hours, hourly_plan, errors));

  // 3. Solar Limits
  checks.push(
    checkSolarLimits(
      hours,
      hourly_plan,
      constraints.effectiveSolarFactors,
      errors
    )
  );

  // 4. Battery Power Rates
  checks.push(checkBatteryRates(battery, hourly_plan, errors));

  // 5. Battery Transitions & Bounds
  const [transCheck, boundsCheck] = checkBatteryTransitions(
    battery,
    hourly_plan,
    constraints.minReserves,
    errors
  );
  checks.push(transCheck, boundsCheck);

  // 6. Neutrality
  const finalEnergy = hourly_plan[23].battery_energy_after_kwh;
  const neutralityPassed =
    Math.abs(finalEnergy - battery.initial_energy_kwh) <= TOLERANCE;
  if (!neutralityPassed) {
    errors.push(
      `Neutrality error: Final energy (${finalEnergy} kWh) != Initial (${battery.initial_energy_kwh} kWh).`
    );
  }
  checks.push({
    details: neutralityPassed
      ? `Final battery energy is ${finalEnergy} kWh (matches initial ${battery.initial_energy_kwh} kWh).`
      : `Neutrality failed: End of day energy is ${finalEnergy} kWh vs initial ${battery.initial_energy_kwh} kWh.`,
    id: "battery-neutrality",
    name: "End-of-Day Battery Neutrality (E_23 = E_initial)",
    passed: neutralityPassed,
  });

  // 7. Directive Windows
  checks.push(checkDirectiveWindows(hourly_plan, constraints, errors));

  // 8. Aggregates Recomputation
  let recalcTotalGrid = 0;
  let recalcTotalCost = 0;
  let recalcPeakGrid = 0;

  for (let h = 0; h < 24; h += 1) {
    const gridKwh = hourly_plan[h].grid_kwh;
    const tariff = hours[h]?.tariff_bdt_per_kwh ?? 0;
    recalcTotalGrid += gridKwh;
    recalcTotalCost += gridKwh * tariff;
    if (gridKwh > recalcPeakGrid) {
      recalcPeakGrid = gridKwh;
    }
  }

  const gridDelta = Math.abs(recalcTotalGrid - response.total_grid_kwh);
  const costDelta = Math.abs(recalcTotalCost - response.total_cost_bdt);
  const peakDelta = Math.abs(recalcPeakGrid - response.peak_grid_kwh);
  const aggPassed =
    gridDelta <= TOLERANCE && costDelta <= TOLERANCE && peakDelta <= TOLERANCE;

  if (!aggPassed) {
    errors.push("Aggregate mismatch with recomputed values.");
  }

  checks.push({
    details: aggPassed
      ? `Totals match within ±0.01 tolerance (Grid: ${recalcTotalGrid.toFixed(1)} kWh, Cost: ৳${recalcTotalCost.toFixed(1)}, Peak: ${recalcPeakGrid.toFixed(1)} kW).`
      : `Totals mismatch: Grid Δ=${gridDelta.toFixed(2)}, Cost Δ=৳${costDelta.toFixed(2)}, Peak Δ=${peakDelta.toFixed(2)}.`,
    id: "aggregates-reconciliation",
    name: "Independent Aggregate Recalculation",
    passed: aggPassed,
  });

  return {
    checks,
    errors,
    isValid: checks.every((c) => c.passed) && errors.length === 0,
    recalculated: {
      peakGrid: Number(recalcPeakGrid.toFixed(2)),
      totalCost: Number(recalcTotalCost.toFixed(2)),
      totalGrid: Number(recalcTotalGrid.toFixed(2)),
    },
    toleranceDelta: {
      costDelta: Number(costDelta.toFixed(3)),
      gridDelta: Number(gridDelta.toFixed(3)),
      peakDelta: Number(peakDelta.toFixed(3)),
    },
    warnings,
  };
}
