# Integration Tests Design

**Date:** 2026-03-07
**Status:** Approved

## Summary

End-to-end integration tests for all 11 command groups (65+ commands) running against a live Docmost instance via docker-compose. Tests execute CLI programmatically (Commander.parseAsync) within vitest, with setup/teardown per test suite for data isolation.

## Decisions

| Decision | Choice | Rationale |
|-|-|-|
| Test type | CLI end-to-end | Test what users actually run |
| Server | Docker-compose (Docmost + PG + Redis) | Realistic, reproducible, CI-friendly |
| Coverage | All 11 groups | Full coverage from the start |
| Data isolation | Setup/teardown per suite | Balance of isolation and speed |
| CLI execution | Programmatic (parseAsync) | Fast, easy data passing between steps |

## Infrastructure

### Docker-compose

`docker-compose.test.yml` in project root:
- Docmost (latest image)
- PostgreSQL 15
- Redis 7

`scripts/wait-for-docmost.sh` — polls healthcheck before tests start.

### Vitest Configuration

- `vitest.integration.config.ts` — separate from unit config
- `npm run test:integration` — integration only
- `npm test` — unit only (unchanged)
- `npm run test:all` — both
- Env: `DOCMOST_TEST_URL`, `DOCMOST_TEST_EMAIL`, `DOCMOST_TEST_PASSWORD`

### Programmatic CLI Runner

`src/__tests__/integration/helpers/run-cli.ts`:
- Imports program from `src/index.ts`
- Intercepts stdout/stderr
- Returns `{ stdout, stderr, exitCode, json() }`
- Clean context per invocation (env vars point to test server)

## Test Structure

```
src/__tests__/
  integration/
    helpers/
      run-cli.ts        # programmatic CLI runner
      setup.ts           # globalSetup: create test workspace/space
      teardown.ts         # globalTeardown: cleanup
    page.test.ts         # page CRUD + move, duplicate, history, restore, trash, breadcrumbs
    space.test.ts        # space CRUD + members
    user.test.ts         # user-info, user-role-update
    group.test.ts        # group CRUD + members
    comment.test.ts      # comment CRUD
    share.test.ts        # share enable/disable/password/search-indexing
    invite.test.ts       # invite create/list/revoke/role-update/count
    workspace.test.ts    # workspace-info, workspace-members, workspace-public-info
    file.test.ts         # file-upload, file-info, file-list
    search.test.ts       # search
    discovery.test.ts    # commands (migrate from existing)
```

### Test Pattern (example: page.test.ts)

```
beforeAll → create test space
  it("page-create") → create page, save ID
  it("page-list") → verify page in list
  it("page-info") → get by ID, check fields
  it("page-update") → update title
  it("page-move") → move to another space
  it("page-duplicate") → duplicate
  it("page-delete") → delete
afterAll → delete test space
```

### Global Setup

- Use env credentials (DOCMOST_TEST_EMAIL / DOCMOST_TEST_PASSWORD)
- Create sandbox space for tests
- Pass IDs via vitest globalThis

### Execution Order

- Tests within a file: sequential (create → read → update → delete)
- Test files: parallel (each has own setup/teardown)

## CI/CD

```yaml
jobs:
  unit-tests:
    # existing fast unit tests, no Docker needed

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - docker-compose -f docker-compose.test.yml up -d
      - wait-for-docmost.sh
      - npm ci && npm run build
      - npm run test:integration
      - docker-compose down
```

Unit and integration jobs run in parallel. Both must pass for merge.

### Local Development

- `npm test` — unit only (fast, no deps)
- `npm run test:integration` — requires running Docmost
- `npm run test:all` — both

## Assertions

### What we check per command:

1. **Exit code** — 0 on success, non-zero on error
2. **JSON envelope** — `{ ok: true, data }` or `{ ok: false, error }`
3. **Data structure** — required fields present (id, title, createdAt...)
4. **Idempotency** — repeated request doesn't corrupt data
5. **Errors** — nonexistent ID → NOT_FOUND, invalid data → VALIDATION_ERROR

### What we do NOT check:

- Specific timestamp values
- JSON field order
- Docmost API implementation details
