# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent-first CLI for Docmost documentation platform. Provides 65 commands across 11 entity groups (page, workspace, invite, user, space, group, comment, share, file, search, plus core utilities) for managing documentation from the terminal.

## Commands

```bash
npm run build      # Compile TypeScript to build/
npm run watch      # Watch mode for development
npm run start      # Run compiled CLI
```

## Architecture

**Entry Point**: `src/index.ts` - Commander.js program setup with global options, 10 command registration calls, and error handling

**Command Registration**: Each entity group has a dedicated module in `src/commands/*.ts` exporting a `register(program)` function that adds all subcommands for that entity.

**Client**: `src/client.ts` - DocmostClient class handling REST API communication

**Core Flow**:
1. Commander parses CLI args, resolves global options (auth, output format)
2. `withClient` creates DocmostClient with resolved auth
3. DocmostClient handles REST API calls with pagination
4. Page content converted bidirectionally: Markdown <-> ProseMirror/TipTap JSON
5. Real-time updates use WebSocket (Hocuspocus) to preserve page IDs

**Key Modules**:

| Module | Purpose |
|-|-|
| `src/index.ts` | CLI entrypoint - program setup, 10 register calls, error handling |
| `src/client.ts` | DocmostClient - REST API client with pagination, CRUD operations |
| `src/lib/cli-utils.ts` | Shared CLI utilities - withClient, printResult, resolveOptions, CliError |
| `src/commands/page.ts` | Page commands: list, info, create, update, move, delete, history, restore, trash, duplicate, breadcrumbs |
| `src/commands/workspace.ts` | Workspace commands: info, members, public-info |
| `src/commands/invite.ts` | Invite commands: list, create, accept, revoke, role-update, count |
| `src/commands/user.ts` | User commands: info, role-update |
| `src/commands/space.ts` | Space commands: list, info, create, update, delete, members, add-member, remove-member, member-role-update, order |
| `src/commands/group.ts` | Group commands: list, info, create, update, delete, members, add-member, remove-member |
| `src/commands/comment.ts` | Comment commands: list, info, create, update, delete |
| `src/commands/share.ts` | Share commands: info, enable, disable, set-password, remove-password, set-search-indexing |
| `src/commands/file.ts` | File commands: upload, info, list |
| `src/commands/search.ts` | Search command |
| `src/commands/discovery.ts` | Discovery: lists all commands with options for agent introspection |
| `lib/collaboration.ts` | WebSocket updates via HocuspocusProvider/Yjs - preserves page ID during edits |
| `lib/markdown-converter.ts` | ProseMirror->Markdown conversion (read path) |
| `lib/auth-utils.ts` | Login (cookie extraction) + collab token fetch |
| `lib/filters.ts` | Strip API responses to essential fields |
| `lib/tiptap-extensions.ts` | TipTap extensions for HTML->ProseMirror (write path) |

**Error Handling**:
- `CliError` class with typed codes: AUTH_ERROR(2), NOT_FOUND(3), VALIDATION_ERROR(4), NETWORK_ERROR(5), INTERNAL_ERROR(1)
- `normalizeError` maps CommanderError/AxiosError -> CliError
- Output: JSON envelope `{ ok: false, error: { code, message, details } }` or plain text

**Output Formats**: `json` (default, envelope `{ ok, data/error }`), `table` (list commands), `text` (content commands)

**JSON Envelope**: All `--format json` responses wrapped in `{ ok: true, data }` (success) or `{ ok: false, error }` (error). Lists include `meta: { count, hasMore }`.

**Content Update Flow** (`page-update`):
1. Markdown -> HTML (marked)
2. HTML -> ProseMirror JSON (generateJSON + tiptapExtensions)
3. ProseMirror -> Y.doc (TiptapTransformer)
4. Sync via WebSocket to Docmost collaboration server

## Environment

Required: `DOCMOST_API_URL` + (`DOCMOST_TOKEN` or `DOCMOST_EMAIL`/`DOCMOST_PASSWORD`)

## Notes

- `page-create` uses import API workaround (multipart/form-data) since Docmost lacks direct content creation endpoint
- Pagination via `paginateAll<T>()` returns `{ items, hasMore }`, handles both `data.items` and `data.data.items` API response structures
- WebSocket connection kept open 15s after update for Docmost's 10s save debounce
- Auth precedence: token > email/password, CLI args > env vars
