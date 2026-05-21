
## Design Decisions

### Strict Mode
All Zod schemas use `.strict()` — unexpected fields cause a parse error. This surfaces schema drift early.

### Monetary Values
All monetary values use `z.number()` — no string coercion. This prevents silent type mismatches.

### Timestamps
All timestamps are ISO 8601 strings validated with `z.string().datetime({ offset: true })`.

### Immutability
All fixture data is declared `as const` before being passed to `schema.parse()`. Fixtures are pure static data — no network calls, no database access, no `Math.random()`.

### MVP Confidence Threshold
The low-confidence threshold is `0.35`. Articles with `confidenceScore < 0.35` must NOT trigger portfolio recommendations. This constant is exported as `MVP_CONFIDENCE_THRESHOLD` from `src/news/low-confidence-noisy.ts`.

### Duplicate Detection
The `duplicate-pair` fixture contains two articles that share the key phrase:
> "TSMC reported Q2 revenue of NT$673.5 billion, beating analyst estimates"

This phrase is exported as `DUPLICATE_KEY_PHRASE` for use in deduplication tests.

### Provider Payload TODOs
Both provider payload fixtures contain `// TODO: align with provider adapter spec` comments. These stubs will be updated once the respective adapter specs are finalised.

## Commands

