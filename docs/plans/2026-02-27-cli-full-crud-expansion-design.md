# CLI Full CRUD Expansion Design

## Context

Docmost CLI is an **agent-first** tool — designed primarily for AI agents and automation.

Design principles:
- **Flat commands** with predictable `<entity>-<action>` naming for tool discovery
- **JSON output** by default for machine parsing
- **No interactive prompts** — all input via flags, env vars, or stdin
- **`--quiet`** global flag — suppress stdout, communicate via exit code only
- **stdin support** for bulk operations (`--emails -` reads from stdin)
- **Smart defaults** — CLI generates sensible values where API requires them (e.g. position strings)

## Naming Convention

All commands follow `<entity>-<action>` pattern. No exceptions.

Existing 17 commands are renamed to match (no backward compatibility needed).

## Complete Command List

### Workspace (3 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `workspace-info` | POST `/workspace/info` | — |
| `workspace-public` | POST `/workspace/public` | — |
| `workspace-update` | POST `/workspace/update` | `--name` |

### Workspace Members (3 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `member-list` | POST `/workspace/members` | — |
| `member-delete` | POST `/workspace/members/delete` | `--user-id` |
| `member-role` | POST `/workspace/members/change-role` | `--user-id`, `--role` |

### Invites (6 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `invite-list` | POST `/workspace/invites` | — |
| `invite-info` | POST `/workspace/invites/info` | `--invitation-id` |
| `invite-create` | POST `/workspace/invites/create` | `--emails` (array/stdin), `--role`, `[--group-ids]` |
| `invite-revoke` | POST `/workspace/invites/revoke` | `--invitation-id` |
| `invite-resend` | POST `/workspace/invites/resend` | `--invitation-id` |
| `invite-link` | POST `/workspace/invites/link` | — |

### Users (2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `user-me` | POST `/users/me` | — |
| `user-update` | POST `/users/update` | `--name` |

### Spaces (10 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `space-list` | POST `/spaces/` | — |
| `space-info` | POST `/spaces/info` | `--space-id` |
| `space-create` | POST `/spaces/create` | `--name`, `[--slug]`, `[--description]` |
| `space-update` | POST `/spaces/update` | `--space-id`, `[--name]`, `[--description]` |
| `space-delete` | POST `/spaces/delete` | `--space-id` |
| `space-export` | POST `/spaces/export` | `--space-id`, `--output`, `[--format]`, `[--include-attachments]` |
| `space-member-list` | POST `/spaces/members` | `--space-id` |
| `space-member-add` | POST `/spaces/members/add` | `--space-id`, `--role`, `[--user-ids]`, `[--group-ids]` |
| `space-member-remove` | POST `/spaces/members/remove` | `--space-id`, (`--user-id` or `--group-id`) |
| `space-member-role` | POST `/spaces/members/change-role` | `--space-id`, `--user-id`, `--role` |

### Groups (8 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `group-list` | POST `/groups/` | — |
| `group-info` | POST `/groups/info` | `--group-id` |
| `group-create` | POST `/groups/create` | `--name`, `[--description]` |
| `group-update` | POST `/groups/update` | `--group-id`, `[--name]`, `[--description]` |
| `group-delete` | POST `/groups/delete` | `--group-id` |
| `group-member-list` | POST `/groups/members` | `--group-id` |
| `group-member-add` | POST `/groups/members/add` | `--group-id`, `--user-ids` (array/stdin) |
| `group-member-remove` | POST `/groups/members/remove` | `--group-id`, `--user-id` |

### Pages (17 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `page-list` | POST `/pages/recent` | `[--space-id]` |
| `page-info` | POST `/pages/info` | `--page-id` |
| `page-create` | POST `/pages/create` | `--space-id`, `[--title]`, `[--icon]`, `[--parent-page-id]` |
| `page-update` | POST `/pages/update` + collab | `--page-id`, `[--title]`, `[--icon]`, `[--content]`, `[--file]` |
| `page-delete` | POST `/pages/delete` | `--page-id`, `[--permanently-delete]` |
| `page-delete-bulk` | POST `/pages/delete` (loop) | `--page-ids` (array/stdin) |
| `page-move` | POST `/pages/move` | `--page-id`, `[--parent-page-id]`, `[--position]` (default: `a00000`) |
| `page-move-to-space` | POST `/pages/move-to-space` | `--page-id`, `--space-id` |
| `page-duplicate` | POST `/pages/duplicate` | `--page-id`, `[--space-id]` |
| `page-breadcrumbs` | POST `/pages/breadcrumbs` | `--page-id` |
| `page-tree` | POST `/pages/sidebar-pages` | `--space-id`, `--page-id` |
| `page-export` | POST `/pages/export` | `--page-id`, `--format`, `[--output]`, `[--include-children]`, `[--include-attachments]` |
| `page-import` | POST `/pages/import` | `--file`, `--space-id` |
| `page-import-zip` | POST `/pages/import-zip` | `--file`, `--space-id` |
| `page-history` | POST `/pages/history` | `--page-id`, `[--cursor]` |
| `page-history-detail` | POST `/pages/history/info` | `--history-id` |
| `page-restore` | POST `/pages/restore` | `--page-id` |
| `page-trash` | POST `/pages/trash` | `--space-id` |

Note on `page-update`: uses REST `/pages/update` for metadata (title, icon, parentPageId) and WebSocket collab for content changes. If only `--title`/`--icon` provided — REST only, no WebSocket.

Note on `page-move`: `--position` defaults to `a00000` inside CLI. Agents don't need to provide it.

### Comments (5 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `comment-list` | POST `/comments/` | `--page-id` |
| `comment-info` | POST `/comments/info` | `--comment-id` |
| `comment-create` | POST `/comments/create` | `--page-id`, `--content` (markdown -> ProseMirror JSON), `[--selection]`, `[--parent-comment-id]` |
| `comment-update` | POST `/comments/update` | `--comment-id`, `--content` (markdown -> ProseMirror JSON) |
| `comment-delete` | POST `/comments/delete` | `--comment-id` |

Note: `--content` accepts markdown. CLI converts to ProseMirror JSON via the same tiptap pipeline used for page content.

### Shares (6 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `share-list` | POST `/shares/` | — |
| `share-get` | POST `/shares/info` | `--share-id` |
| `share-for-page` | POST `/shares/for-page` | `--page-id` |
| `share-create` | POST `/shares/create` | `--page-id`, `[--include-subpages]`, `[--search-indexing]` |
| `share-update` | POST `/shares/update` | `--share-id`, `[--include-subpages]`, `[--search-indexing]` |
| `share-delete` | POST `/shares/delete` | `--share-id` |

### Files (2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `file-upload` | POST `/files/upload` | `--file`, `--page-id` |
| `file-download` | GET `/files/:id/:name` | `--file-id`, `--output` (file path) |

### Search (2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `search` | POST `/search/` | `--query`, `[--space-id]` |
| `search-suggest` | POST `/search/suggest` | `--query`, `[--space-id]` |

## Totals

**67 commands** across 11 groups.

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
| `--output` | `json` (default), `table`, `text` |
| `--quiet` / `-q` | Suppress stdout, exit code only |

## Architecture

### Client (`src/client.ts`)

Add methods per entity. All follow existing pattern:
- `ensureAuthenticated()` before each call
- `paginateAll()` for list endpoints
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

### Binary exports

`space-export` and `page-export` write to path specified by `--output`. If omitted, write to stdout (for piping).
