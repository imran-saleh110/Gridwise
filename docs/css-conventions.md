# CSS Conventions

The project uses **Tailwind CSS v4** with the shared design tokens from
`@repo/ui` (see `docs/design-system.md`). Utility classes are the default;
custom CSS is the exception.

- Style with Tailwind utilities and semantic tokens (`bg-card`,
  `text-muted-foreground`, `border-border`) instead of raw hex or ad-hoc CSS.
- Reuse existing custom properties and shadcn tokens before introducing new
  ones. New tokens belong in `packages/ui/src/styles/globals.css` under `:root`
  (the app is dark-only) and must be exposed via `@theme inline`.
- Prefer shared components from `@repo/ui` over hand-rolled markup. Extend a
  component's `className` or variants rather than forking it.
- Only reach for plain CSS (a module or a few rules in `globals.css`) for things
  utilities express poorly: keyframes, complex selectors, or third-party resets.
  Keep specificity low and avoid `!important`.
- Use Grid/Flexbox utilities for layout; design mobile-first and verify layouts
  at narrow and wide viewports.
- Provide visible `:focus-visible` styles (the theme's `ring` tokens) and do not
  remove focus indicators without an accessible replacement.
- Ensure hover-only information is also available to keyboard and touch users.
- Respect `prefers-reduced-motion` for nonessential motion and keep transitions
  limited to properties that do not trigger unnecessary layout work.
- Maintain sufficient contrast against the dark interface.
