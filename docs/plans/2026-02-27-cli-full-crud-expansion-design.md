# CLI Full CRUD Expansion Design

## Context

Docmost CLI is an **agent-first** tool: designed primarily for AI agents and automation, not interactive human use. This means:
- Flat command names (no subcommands) for predictable tool discovery
- JSON output by default for machine parsing
- No interactive prompts — all parameters via flags/env
- Consistent naming: `<entity>-<action>` pattern

Current state: 17 commands covering Pages (full CRUD) + read-only Spaces/Groups/Workspace.
Docmost API surface: ~60 endpoints across 10 entities.

## Goal

Expand CLI from 17 to ~57 commands, covering full CRUD for all Docmost entities.

## Naming Convention

Flat with entity prefix: `<entity>-<action>`.

Existing commands (`list-spaces`, `list-groups`, `get-page`, etc.) remain unchanged for backward compatibility.

New commands follow `<entity>-<action>` pattern consistently.

## New Commands by Entity

### Spaces (+8 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `space-info` | POST `/spaces/info` | `--space-id` |
| `space-create` | POST `/spaces/create` | `--name`, `--slug`, `--description` |
| `space-update` | POST `/spaces/update` | `--space-id`, `--name`, `--description` |
| `space-delete` | POST `/spaces/delete` | `--space-id` |
| `space-export` | POST `/spaces/export` | `--space-id`, `--format` |
| `space-members` | POST `/spaces/members` | `--space-id` |
| `space-member-add` | POST `/spaces/members/add` | `--space-id`, `--user-id`, `--role` |
| `space-member-remove` | POST `/spaces/members/remove` | `--space-id`, `--user-id` |
| `space-member-role` | POST `/spaces/members/change-role` | `--space-id`, `--user-id`, `--role` |

### Groups (+7 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `group-info` | POST `/groups/info` | `--group-id` |
| `group-create` | POST `/groups/create` | `--name`, `--description` |
| `group-update` | POST `/groups/update` | `--group-id`, `--name`, `--description` |
| `group-delete` | POST `/groups/delete` | `--group-id` |
| `group-members` | POST `/groups/members` | `--group-id` |
| `group-member-add` | POST `/groups/members/add` | `--group-id`, `--user-id` |
| `group-member-remove` | POST `/groups/members/remove` | `--group-id`, `--user-id` |

### Workspace & Members (+5 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `workspace-update` | POST `/workspace/update` | `--name`, `--logo` |
| `workspace-members` | POST `/workspace/members` | — |
| `workspace-member-delete` | POST `/workspace/members/delete` | `--user-id` |
| `workspace-member-role` | POST `/workspace/members/change-role` | `--user-id`, `--role` |
| `workspace-member-deactivate` | POST `/workspace/members/deactivate` | `--user-id` |

### Invites (+4 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `invite-list` | POST `/workspace/invites` | — |
| `invite-create` | POST `/workspace/invites/create` | `--email`, `--role` |
| `invite-revoke` | POST `/workspace/invites/revoke` | `--invite-id` |
| `invite-resend` | POST `/workspace/invites/resend` | `--invite-id` |

### Comments (+5 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `comment-list` | POST `/comments/` | `--page-id` |
| `comment-info` | POST `/comments/info` | `--comment-id` |
| `comment-create` | POST `/comments/create` | `--page-id`, `--content` |
| `comment-update` | POST `/comments/update` | `--comment-id`, `--content` |
| `comment-delete` | POST `/comments/delete` | `--comment-id` |

### Shares (+5 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `share-list` | POST `/shares/` | — |
| `share-info` | POST `/shares/for-page` | `--page-id` |
| `share-create` | POST `/shares/create` | `--page-id` |
| `share-update` | POST `/shares/update` | `--share-id`, `--password` |
| `share-delete` | POST `/shares/delete` | `--share-id` |

### Users (+2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `whoami` | POST `/users/me` | — |
| `user-update` | POST `/users/update` | `--name` |

### Pages extras (+2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `page-export` | POST `/pages/export` | `--page-id`, `--format` |
| `page-import` | POST `/pages/import` | `--file`, `--space-id` |

### Files (+2 commands)

| Command | Endpoint | Key params |
|-|-|-|
| `file-upload` | POST `/files/upload` | `--file`, `--page-id` |
| `file-download` | GET `/files/:id/:name` | `--file-id`, `--output` |

## Architecture

### Client Layer (`src/client.ts`)

Add methods matching each new endpoint. Group by entity with JSDoc comments. All methods follow existing patterns:
- `ensureAuthenticated()` before each call
- `paginateAll()` for list endpoints
- Return filtered results via `src/lib/filters.ts`

### Filters (`src/lib/filters.ts`)

Add filter functions for new entities: `filterComment`, `filterShare`, `filterInvite`, `filterMember`, `filterUser`.

### Commands (`src/index.ts`)

Each command registered via Commander with:
- Required options marked with `<value>`, optional with `[value]`
- `withClient()` wrapper for auth
- Output respects `--output` format flag
- Errors mapped through `normalizeError` → `CliError`

### Output consistency

All commands return:
- **JSON** (default): `{ data: ..., success: true }` for single items, `{ items: [...] }` for lists
- **Table**: formatted with `cli-table3` for list commands
- **Text**: human-readable for content commands

## Summary

- **40 new commands** across 8 entity groups
- **57 total commands** after expansion
- Backward compatible — all 17 existing commands unchanged
- Agent-first: flat names, JSON output, no interactivity
