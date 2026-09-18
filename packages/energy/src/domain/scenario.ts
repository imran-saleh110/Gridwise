export interface Hour {
  readonly demand_kwh: number;
  readonly hour: number;
  readonly solar_kwh: number;
  readonly tariff_bdt_per_kwh: number;
}

export interface Battery {
  readonly capacity_kwh: number;
  readonly initial_energy_kwh: number;
  readonly max_charge_kwh_per_hour: number;
  readonly max_discharge_kwh_per_hour: number;
  readonly minimum_energy_kwh: number;
}

export interface Scenario {
  readonly battery: Battery;
  readonly hours: readonly Hour[];
  readonly operator_notes: readonly string[];
  readonly scenario_id: string;
}
