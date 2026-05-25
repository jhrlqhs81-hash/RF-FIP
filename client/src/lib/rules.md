# Client Lib Rules

- Do not change API wrapper return shapes without updating docs.
- Do not hide failed API requests; throw or surface clear errors.
- Local RF analyzer must be deterministic.
- Gauss calls must remain server-owned, not client-owned.
- Preserve SignatureTag key/value shape.
- Use `Array.from(value.matchAll(...))` before iteration; direct `for...of` over RegExp iterators fails under the current TypeScript target.
- Initial persistence load may fall back to bundled mock data when `/api/health` is unavailable, but real API/DB errors must still surface.
