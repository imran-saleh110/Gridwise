# API conventions

API modules generally follow route -> controller -> repository. Existing services may remain, but new business logic should be placed in controllers so HTTP and domain behavior can be understood together.

Routes should validate external input. Zod is preferred, although straightforward string fields may use explicit checks to keep schemas simple. Repository classes own persistence, but read-only routes may access exported collections directly when no business rules are involved.

Successful API responses should use:

```json
{ "data": {}, "meta": {} }
```

Errors should use:

```json
{ "error": { "messege": "Something went wrong", "status": 400 } }
```

Use conventional HTTP statuses. A duplicate resource can return either 400 or 409 depending on whether the conflict is discovered during validation or persistence.
