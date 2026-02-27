# CLI Full CRUD Expansion Design

## Context

Docmost CLI is an **agent-first** tool — designed primarily for AI agents and automation.

Design principles:
- **Flat commands** with predictable `<entity>-<action>` naming for tool discovery
- **JSON output** by default for machine parsing
- **No interactive prompts** — all input via flags, env vars, or stdin
- **No destructive confirmations** — agents are responsible for passing correct IDs. CLI does not prompt `--confirm` for deletes. This is intentional for automation.
- **`--quiet`** global flag — suppress stdout and stderr, communicate via exit code only. Exit codes: 0=success, 1=internal error, 2=auth error, 3=not found, 4=validation error, 5=network error.
- **stdin support** for bulk operations (`--emails -` reads from stdin)
- **Smart defaults** — CLI generates sensible values where API requires them (e.g. position strings)

## Naming Convention

All commands follow `<entity>-<action>` pattern. No exceptions.

All parameters are flags (`--flag-name`), not positional arguments. This is more predictable for agents.

Existing 17 commands are renamed to match (no backward compatibility needed).

## Pagination

List commands (`*-list`, `page-trash`, `page-history`) use `paginateAll()` internally — they fetch ALL results by default.

Optional flags for controlling pagination:
- `--limit <n>` — max items per API call (1-100, default: 100)
- `--max-items <n>` — stop after N total items (default: unlimited)

This lets agents fetch everything (default) or limit for large datasets.

## Complete Command List

### Workspace (3 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `workspace-info` | POST `/workspace/info` | — |
| `workspace-public` | POST `/workspace/public` | — |
| `workspace-update` | POST `/workspace/update` | `[--name]`, `[--hostname]`, `[--description]`, `[--logo]`, `[--email-domains]`, `[--enforce-sso]`, `[--enforce-mfa]`, `[--restrict-api-to-admins]` |

### Workspace Members (3 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `member-list` | POST `/workspace/members` | — |
| `member-remove` | POST `/workspace/members/delete` | `--user-id` |
| `member-role` | POST `/workspace/members/change-role` | `--user-id`, `--role` (owner/admin/member) |

### Invites (6 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `invite-list` | POST `/workspace/invites` | — |
| `invite-info` | POST `/workspace/invites/info` | `--invitation-id` |
| `invite-create` | POST `/workspace/invites/create` | `--emails` (array/stdin), `--role` (owner/admin/member), `[--group-ids]` |
| `invite-revoke` | POST `/workspace/invites/revoke` | `--invitation-id` |
| `invite-resend` | POST `/workspace/invites/resend` | `--invitation-id` |
| `invite-link` | POST `/workspace/invites/link` | `--invitation-id` (returns `{ inviteLink: "url" }` — text mode outputs URL only) |

### Users (2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `user-me` | POST `/users/me` | — |
| `user-update` | POST `/users/update` | `[--name]`, `[--email]`, `[--avatar-url]`, `[--full-page-width]`, `[--page-edit-mode]` (read/edit), `[--locale]` |

### Spaces (10 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `space-list` | POST `/spaces/` | — |
| `space-info` | POST `/spaces/info` | `--space-id` |
| `space-create` | POST `/spaces/create` | `--name`, `[--slug]`, `[--description]` |
| `space-update` | POST `/spaces/update` | `--space-id`, `[--name]`, `[--description]` |
| `space-delete` | POST `/spaces/delete` | `--space-id` |
| `space-export` | POST `/spaces/export` | `--space-id`, `[--output]`, `[--export-format]` (html/markdown), `[--include-attachments]` |
| `space-member-list` | POST `/spaces/members` | `--space-id` |
| `space-member-add` | POST `/spaces/members/add` | `--space-id`, `--role` (admin/writer/reader), `[--user-ids]`, `[--group-ids]` (CLI sends `[]` if omitted) |
| `space-member-remove` | POST `/spaces/members/remove` | `--space-id`, (`--user-id` or `--group-id`) |
| `space-member-role` | POST `/spaces/members/change-role` | `--space-id`, `--role` (admin/writer/reader), (`--user-id` or `--group-id`) |

### Groups (8 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `group-list` | POST `/groups/` | — |
| `group-info` | POST `/groups/info` | `--group-id` |
| `group-create` | POST `/groups/create` | `--name`, `[--description]`, `[--user-ids]` |
| `group-update` | POST `/groups/update` | `--group-id`, `[--name]`, `[--description]` |
| `group-delete` | POST `/groups/delete` | `--group-id` |
| `group-member-list` | POST `/groups/members` | `--group-id` |
| `group-member-add` | POST `/groups/members/add` | `--group-id`, `--user-ids` (array/stdin) |
| `group-member-remove` | POST `/groups/members/remove` | `--group-id`, `--user-id` |

### Pages (18 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `page-list` | POST `/pages/recent` | `[--space-id]` |
| `page-info` | POST `/pages/info` | `--page-id` |
| `page-create` | POST `/pages/create` | `--space-id`, `[--title]`, `[--icon]`, `[--parent-page-id]` |
| `page-update` | POST `/pages/update` + collab | `--page-id`, `[--title]`, `[--icon]`, `[--content]`, `[--file]` |
| `page-delete` | POST `/pages/delete` | `--page-id`, `[--permanently-delete]` |
| `page-delete-bulk` | POST `/pages/delete` (loop) | `--page-ids` (array/stdin) |
| `page-move` | POST `/pages/move` | `--page-id`, `[--parent-page-id]`, `[--root]`, `[--position]` (default: `a00000`) |
| `page-move-to-space` | POST `/pages/move-to-space` | `--page-id`, `--space-id` |
| `page-duplicate` | POST `/pages/duplicate` | `--page-id`, `[--space-id]` |
| `page-breadcrumbs` | POST `/pages/breadcrumbs` | `--page-id` |
| `page-tree` | POST `/pages/sidebar-pages` | `[--space-id]`, `[--page-id]` (at least one required) |
| `page-export` | POST `/pages/export` | `--page-id`, `--export-format` (html/markdown), `[--output]`, `[--include-children]`, `[--include-attachments]` |
| `page-import` | POST `/pages/import` | `--file`, `--space-id` |
| `page-import-zip` | POST `/pages/import-zip` | `--file`, `--space-id`, `--source` (generic/notion/confluence) |
| `page-history` | POST `/pages/history` | `--page-id` |
| `page-history-detail` | POST `/pages/history/info` | `--history-id` |
| `page-restore` | POST `/pages/restore` | `--page-id` |
| `page-trash` | POST `/pages/trash` | `--space-id` |

Note on `page-update`: uses REST `/pages/update` for metadata (title, icon, parentPageId) and WebSocket collab for content changes. If only `--title`/`--icon` provided — REST only, no WebSocket. If WebSocket connection fails during content update, CLI exits with NETWORK_ERROR (exit code 5) and a clear error message — no silent failures.

Note on `page-move`: `--position` defaults to `a00000` inside CLI. `--root` moves page to space root (sets parentPageId to null). `--root` and `--parent-page-id` are mutually exclusive.

### Comments (5 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `comment-list` | POST `/comments/` | `--page-id` |
| `comment-info` | POST `/comments/info` | `--comment-id` |
| `comment-create` | POST `/comments/create` | `--page-id`, `--content` (markdown -> ProseMirror JSON), `[--selection]`, `[--parent-comment-id]` |
| `comment-update` | POST `/comments/update` | `--comment-id`, `--content` (markdown -> ProseMirror JSON) |
| `comment-delete` | POST `/comments/delete` | `--comment-id` |

Note: `--content` accepts markdown. CLI converts to ProseMirror JSON via the same tiptap pipeline used for page content. The API validates content with `@IsJSON()` — expects a JSON **string**, so CLI must `JSON.stringify()` the ProseMirror output before sending.

### Shares (6 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `share-list` | POST `/shares/` | — |
| `share-info` | POST `/shares/info` | `--share-id` |
| `share-for-page` | POST `/shares/for-page` | `--page-id` |
| `share-create` | POST `/shares/create` | `--page-id`, `[--include-subpages]`, `[--search-indexing]` |
| `share-update` | POST `/shares/update` | `--share-id`, `[--include-subpages]`, `[--search-indexing]` |
| `share-delete` | POST `/shares/delete` | `--share-id` |

### Files (2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `file-upload` | POST `/files/upload` (multipart/form-data) | `--file`, `--page-id`, `[--attachment-id]` |
| `file-download` | GET `/files/:id/:name` | `--file-id`, `--file-name`, `[--output]` (default: stdout) |

Note: `file-upload` sends multipart/form-data. `file-download` requires both `--file-id` and `--file-name` (both are part of the URL path). If `--output` omitted, binary content goes to stdout (for piping). Binary exports (`space-export`, `page-export`) follow the same convention.

### Search (2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `search` | POST `/search/` | `--query`, `[--space-id]`, `[--creator-id]` |
| `search-suggest` | POST `/search/suggest` | `--query`, `[--space-id]`, `[--include-users]`, `[--include-groups]`, `[--include-pages]`, `[--limit]` |

## Totals

**65 commands** across 11 groups.

Renamed from existing 17:

| Old name | New name |
|-|-|
| `workspace` | `workspace-info` |
| `list-spaces` | `space-list` |
| `list-groups` | `group-list` |
| `list-pages` | `page-list` |
| `get-page` | `page-info` |
| `create-page` | `page-create` |
| `update-page` | `page-update` |
| `delete-page` | `page-delete` |
| `delete-pages` | `page-delete-bulk` |
| `move-page` | `page-move` |
| `duplicate-page` | `page-duplicate` |
| `breadcrumbs` | `page-breadcrumbs` |
| `search` | `search` |
| `page-history` | `page-history` |
| `page-history-detail` | `page-history-detail` |
| `restore-page` | `page-restore` |
| `trash` | `page-trash` |

## Global Options

| Flag | Description |
|-|-|
| `--api-url` / `DOCMOST_API_URL` | Docmost instance URL |
| `--token` / `DOCMOST_TOKEN` | API token |
| `--email` / `DOCMOST_EMAIL` | Email for login |
| `--password` / `DOCMOST_PASSWORD` | Password for login |
| `--format` / `-f` | `json` (default), `table`, `text` |
| `--quiet` / `-q` | Suppress stdout+stderr, exit code only |
| `--limit` | Items per API page (1-100, default: 100) |
| `--max-items` | Stop after N total items (default: unlimited) |

## Architecture

### Client (`src/client.ts`)

Add methods per entity. All follow existing pattern:
- `ensureAuthenticated()` before each call
- `paginateAll()` for list endpoints (respects `--limit` and `--max-items`)
- Return filtered results via `src/lib/filters.ts`

### Filters (`src/lib/filters.ts`)

New filter functions: `filterComment`, `filterShare`, `filterInvite`, `filterMember`, `filterUser`.

### Commands — split by entity

Move from monolithic `src/index.ts` into separate files:
- `src/commands/workspace.ts`
- `src/commands/space.ts`
- `src/commands/group.ts`
- `src/commands/page.ts`
- `src/commands/comment.ts`
- `src/commands/share.ts`
- `src/commands/invite.ts`
- `src/commands/user.ts`
- `src/commands/file.ts`
- `src/commands/search.ts`

Each module exports `register(program: Command)` called from `src/index.ts`.

### Comment content handling

Comments use ProseMirror JSON internally. CLI accepts markdown `--content` and converts:
1. Markdown -> HTML (marked)
2. HTML -> ProseMirror JSON (generateJSON + tiptapExtensions)

### Binary exports & file handling

`space-export`, `page-export`, `file-download` output binary data.
- With `--output <path>`: write to file. Overwrite if exists.
- Without `--output`: write to stdout (for piping: `docmost page-export --page-id X --format md > out.md`).

`file-upload`, `page-import`, `page-import-zip` use multipart/form-data uploads.
