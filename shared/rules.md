# Shared Rules

- Shared RF rule modules must be deterministic and must not call network, storage, browser, or provider APIs.
- Keep RF extraction and intent terms centralized here when both client and server need the same behavior.
- Do not import from `client/` or `server/` into `shared/`.
- If a shared rule changes extraction, update or add a smoke that compares at least one client consumer and one server consumer.
