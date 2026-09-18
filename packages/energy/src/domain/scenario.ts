/**
 * Scenario domain types for the GridWise energy-optimization challenge.
 *
 * These types represent the raw input domain model — the data as received from
 * the operator. They are framework-independent; no Hono, Express, or tRPC
 * concerns belong here.
 *
 * Source of truth: BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json
 * (schema_notes.input_required_fields, hour_required_fields, battery_required_fields)
 */

/**
 * A single hour's energy forecast data.
 *
 * - `hour`: integer in [0, 23] — the hour of the 24-hour window.
 * - `demand_kwh`: total campus electricity demand for this hour.
 * - `solar_kwh`: raw solar generation forecast for this hour (before any
 *   solar_reduction directive is applied).
 * - `tariff_bdt_per_kwh`: grid electricity purchase price in BDT per kWh.
 */
export interface Hour {
  readonly hour: number;
  readonly demand_kwh: number;
  readonly solar_kwh: number;
  readonly tariff_bdt_per_kwh: number;
}

/**
 * Battery storage configuration.
 *
 * All kWh values are non-negative. The optimizer enforces:
 *   minimum_energy_kwh <= battery_energy_after_kwh <= capacity_kwh (each hour)
 *   E_hour_23 == initial_energy_kwh (end-of-day neutrality)
 */
export interface Battery {
  /** Total usable storage capacity (kWh). */
  readonly capacity_kwh: number;
  /** Battery state of charge at the start of hour 0 (kWh). */
  readonly initial_energy_kwh: number;
  /** Hard minimum battery level that must never be violated (kWh). */
  readonly minimum_energy_kwh: number;
  /** Maximum energy that can be added in a single hour (kWh). */
  readonly max_charge_kwh_per_hour: number;
  /** Maximum energy that can be removed in a single hour (kWh). */
  readonly max_discharge_kwh_per_hour: number;
}

/**
 * The complete optimization scenario supplied by the operator.
 *
 * Structural invariants (enforced by request validation, not here):
 *   - operator_notes: 1–3 non-empty strings
 *   - hours: exactly 24 entries covering hour values 0..23, no duplicates
 */
export interface Scenario {
  /** Unique identifier for this optimization run. */
  readonly scenario_id: string;
  /**
   * Natural-language instructions from the campus operator.
   * Between 1 and 3 entries; each string is non-empty.
   */
  readonly operator_notes: readonly string[];
  /**
   * Per-hour energy data for the 24-hour window.
   * Exactly 24 entries; hour values cover 0..23.
   */
  readonly hours: readonly Hour[];
  /** Battery storage configuration for this scenario. */
  readonly battery: Battery;
}
