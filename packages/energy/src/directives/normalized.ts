export interface NormalizedDirectives {
  readonly charge_allowed: readonly boolean[];
  readonly discharge_allowed: readonly boolean[];
  readonly effective_solar_factor: readonly number[];
  readonly max_grid_import: readonly number[];
  readonly minimum_reserve: readonly number[];
}
