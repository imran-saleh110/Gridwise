# Testing

- Do not do premature testing. Always test after a particular feature has been implemented entirely.
- Add unit tests for business logic and important utilities.
- API tests should exercise endpoints through the Hono request helper.
- Integration-style API tests may start the development server when behavior depends on Node networking.
- UI tests should focus on user-visible outcomes rather than implementation details.
- Snapshot tests are appropriate for stable component output.

Run the narrowest relevant tests during development.
