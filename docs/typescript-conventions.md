# TypeScript Conventions

- Enable strict TypeScript checking and resolve type errors instead of weakening compiler options.
- Prefer type inference when TypeScript can clearly infer the type.
- Add explicit types when they improve clarity or define an API boundary.
- Prefer `interface` for object-shaped public contracts and `type` for unions, intersections, and derived types.
- Prefer discriminated unions for values with multiple possible states.
- Use `unknown` instead of `any` for values whose type is not known.
- Avoid unnecessary type assertions (`as`). Narrow the type instead whenever possible.
- Use built-in utility types such as `Pick`, `Omit`, `Partial`, `Required`, `Readonly`, `Record`, `ReturnType`, `Parameters`, and `Awaited` instead of duplicating types.
- Prefer reusable types derived from existing types rather than manually maintaining duplicate shapes.
- Use `const` by default; use `let` only when reassignment is required.
- Prefer small, focused functions with explicit inputs and predictable return values.
- Keep types close to the code they describe unless they are shared across multiple modules.
- Prefer type-safe error handling and structured error/result types over scattered ad-hoc error handling.
- Use exhaustive checks with `never` where appropriate for discriminated unions.
- Don't add TypeScript complexity merely because the language supports an advanced feature; favor the simplest type that accurately models the code.
