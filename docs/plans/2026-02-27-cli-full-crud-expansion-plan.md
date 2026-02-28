# CLI Full CRUD Expansion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand agent-first Docmost CLI from 17 to 65 commands with unified `<entity>-<action>` naming.

**Architecture:** Refactor monolithic `src/index.ts` into `src/commands/*.ts` modules. Extend `src/client.ts` with new API methods. Add filter functions for new entities. Rename all 17 existing commands to `<entity>-<action>` pattern.

**Tech Stack:** TypeScript, Commander.js 14, axios, tiptap/ProseMirror (comments), form-data (uploads)

**Design doc:** `docs/plans/2026-02-27-cli-full-crud-expansion-design.md`

---

## Key Implementation Notes

**Compilation safety:** Every task must end with `npm run build` passing. Never change a function signature without updating all call sites in the same task.

**`printResult` migration:** Task 1 keeps the OLD signature `printResult(data, output, options)`. Task 2 changes it to `printResult(data, opts, options)` where `opts: ResolvedOptions` — and updates all call sites simultaneously during the move to commands/page.ts.

**`output` → `format` rename:** The global option rename happens in two steps:
- Task 1: Add `format` field to GlobalOptions/ResolvedOptions in cli-utils.ts, keep `output` as alias for backward compat during transition
- Task 2: Replace all `opts.output` → `opts.format` when moving commands to page.ts. Remove `output` alias.

**`page-create` strategy:** Docmost's `/pages/create` endpoint creates metadata-only pages (title, icon, parentPageId) — no content. The current import workaround stays as `page-import`. `page-create` uses REST for metadata. To create a page WITH content, agents call `page-create` then `page-update`.

**`page-history` pagination:** Current code uses cursor-based pagination. Docmost API actually uses standard page-based `PaginationOptions` for this endpoint. Refactor to use `paginateAll()`.

**`createReadStream` import:** Client methods that upload files need `import { createReadStream } from "fs";` at top of `src/client.ts`.

---

## Phase 0: Infrastructure Refactoring

### Task 1: Extract shared utilities into src/lib/cli-utils.ts

**Files:**
- Create: `src/lib/cli-utils.ts`
- Modify: `src/index.ts`

**Step 1:** Create `src/lib/cli-utils.ts` — extract from `src/index.ts`:

```typescript
// Types: OutputFormat, GlobalOptions, ResolvedOptions, CliErrorCode
// Constants: EXIT_CODES
// Classes: CliError
// Functions: normalizeOutputFormat, resolveOptions, flattenForTable, toTableRows,
//   printResult, ensureOutputSupported, isCommanderHelpExit, normalizeError,
//   printError, getSafeOutput, readStdin, resolveContentInput, withClient
// Rename: parsePageIds → parseCommaSeparatedIds(flagName: string, csv: string)
```

**Step 2:** Update types for new global options — but keep OLD `printResult` signature:

```typescript
type GlobalOptions = {
  apiUrl?: string;
  email?: string;
  password?: string;
  token?: string;
  output?: string;    // keep for now, renamed in Task 2
  format?: string;    // new name
  quiet?: boolean;
  limit?: string;     // string from Commander, parse to number
  maxItems?: string;
};

type ResolvedOptions = {
  apiUrl: string;
  output: OutputFormat;  // keep for Task 1 compat
  format: OutputFormat;  // alias — same value
  quiet: boolean;
  limit: number;
  maxItems: number;
  auth: ClientAuthOptions;
};
```

In `resolveOptions`: set both `output` and `format` to the same resolved value. Parse `limit`/`maxItems` from strings to numbers.

**Step 3:** `printResult` stays with OLD signature — no breaking changes yet:

```typescript
// KEEP old signature in Task 1:
function printResult(data: unknown, output: OutputFormat, options?: PrintOptions) { ... }
```

Add separate `printResultQuiet`-aware wrapper that commands can opt into later.

**Step 4:** Update `src/index.ts` — import everything from cli-utils, add new Commander options:

```typescript
.option("-f, --format <format>", "Output format: json | table | text", "json")
.option("-q, --quiet", "Suppress output, exit code only")
.option("--limit <n>", "Items per API page (1-100)")
.option("--max-items <n>", "Stop after N total items")
```

Keep `-o, --output` as hidden alias for `--format` during transition.

**Step 5:** `npm run build` — must pass with zero changes to existing command behavior.

**Step 6:** Commit: `refactor: extract shared CLI utilities into src/lib/cli-utils.ts`

---

### Task 2: Rename existing commands and move to src/commands/page.ts

**Files:**
- Create: `src/commands/page.ts`
- Modify: `src/index.ts`
- Modify: `src/lib/cli-utils.ts`

**Step 1:** Update `printResult` signature in cli-utils.ts:

```typescript
function printResult(data: unknown, opts: ResolvedOptions, options?: PrintOptions) {
  if (opts.quiet) return;
  // use opts.format instead of output parameter
}
```

Update `ensureOutputSupported` similarly to take `opts.format`.

**Step 2:** Create `src/commands/page.ts` with `register(program: Command)`. Move all 17 commands, renaming and updating:

| Old command | New command | Other changes |
|-|-|-|
| `workspace` | `workspace-info` | — |
| `list-spaces` | `space-list` | — |
| `list-groups` | `group-list` | — |
| `list-pages` | `page-list` | — |
| `get-page` | `page-info` | — |
| `create-page` | `page-create` | Change to REST `/pages/create`: `--space-id` required, `[--title]`, `[--icon]`, `[--parent-page-id]`. No `--content`. |
| `update-page` | `page-update` | Add `[--icon]`, rename behavior: REST for metadata, collab for content |
| `delete-page` | `page-delete` | Rename `--permanent` → `--permanently-delete` |
| `delete-pages` | `page-delete-bulk` | — |
| `move-page` | `page-move` | — |
| `duplicate-page` | `page-duplicate` | — |
| `breadcrumbs` | `page-breadcrumbs` | — |
| `search` | `search` | Change `.argument("<query>")` → `.requiredOption("--query <q>")`, add `[--creator-id]` |
| `page-history` | `page-history` | Remove `--cursor`, switch to `paginateAll()` |
| `page-history-detail` | `page-history-detail` | — |
| `restore-page` | `page-restore` | — |
| `trash` | `page-trash` | — |

All calls to `printResult(result, opts.output, ...)` → `printResult(result, opts, ...)`.

**Step 3:** Remove `registerCommands` from index.ts, add:

```typescript
import { register as registerPageCommands } from "./commands/page.js";
registerPageCommands(program);
```

**Step 4:** `npm run build` — verify all commands work with new names.

**Step 5:** Commit: `refactor: rename commands to <entity>-<action>, extract to commands/page.ts`

---

### Task 3: Add maxItems support to paginateAll

**Files:**
- Modify: `src/client.ts`

**Step 1:** Add `maxItems` parameter (limit parameter already exists):

```typescript
async paginateAll<T = unknown>(
  endpoint: string,
  basePayload: Record<string, unknown> = {},
  limit: number = 100,
  maxItems: number = Infinity,  // NEW
): Promise<T[]> {
  // ... existing code ...
  // Add to while condition: && allItems.length < maxItems
  // After loop: return maxItems < Infinity ? allItems.slice(0, maxItems) : allItems;
}
```

**Step 2:** `npm run build`

**Step 3:** Commit: `feat: add maxItems support to paginateAll`

---

## Phase 1: Admin Entity Commands

### Task 4: Workspace commands (workspace-info, workspace-public, workspace-update)

**Files:**
- Modify: `src/client.ts` — add `getWorkspacePublic()`, `updateWorkspace()`
- Create: `src/commands/workspace.ts` — 3 commands
- Modify: `src/index.ts` — register
- Modify: `src/commands/page.ts` — move `workspace-info` to workspace.ts

**Step 1:** Client methods:

```typescript
async getWorkspacePublic() {
  const response = await this.client.post("/workspace/public", {});
  return response.data;
}

async updateWorkspace(params: Record<string, unknown>) {
  await this.ensureAuthenticated();
  const response = await this.client.post("/workspace/update", params);
  return response.data;
}
```

**Step 2:** Create `src/commands/workspace.ts`:
- Move `workspace-info` from page.ts
- Add `workspace-public` (no auth needed)
- Add `workspace-update` with flags: `[--name]`, `[--hostname]`, `[--description]`, `[--logo]`, `[--email-domains]`, `[--enforce-sso]`, `[--enforce-mfa]`, `[--restrict-api-to-admins]`

**Step 3:** Register. Build. Commit: `feat: add workspace commands`

---

### Task 5: Member commands (member-list, member-remove, member-role)

**Files:**
- Modify: `src/client.ts`
- Modify: `src/lib/filters.ts` — add `filterMember`
- Modify: `src/commands/workspace.ts` — add 3 commands

**Step 1:** Add filter:

```typescript
export function filterMember(member: any) {
  return {
    id: member.id, name: member.name, email: member.email,
    role: member.role, createdAt: member.createdAt,
  };
}
```

**Step 2:** Client methods: `getMembers`, `removeMember`, `changeMemberRole`.

**Step 3:** Add commands to workspace.ts:
- `member-role --role` uses `.choices(["owner", "admin", "member"])`

**Step 4:** Build. Commit: `feat: add workspace member commands`

---

### Task 6: Invite commands (6 commands)

**Files:**
- Modify: `src/client.ts`
- Modify: `src/lib/filters.ts` — add `filterInvite`
- Create: `src/commands/invite.ts` — 6 commands
- Modify: `src/index.ts`

**Step 1:** Add filter:

```typescript
export function filterInvite(invite: any) {
  return {
    id: invite.id, email: invite.email, role: invite.role,
    status: invite.status, invitedById: invite.invitedById, createdAt: invite.createdAt,
  };
}
```

**Step 2:** Client methods: `getInvites`, `getInviteInfo`, `createInvite`, `revokeInvite`, `resendInvite`, `getInviteLink`.

**Step 3:** Create `src/commands/invite.ts`:
- `invite-create --emails` uses `parseCommaSeparatedIds()` or stdin, `--role` uses `.choices(["owner", "admin", "member"])`, `[--group-ids]`
- `invite-link` text extractor: `(data) => data.inviteLink`
- All ID params: `--invitation-id`

**Step 4:** Register. Build. Commit: `feat: add invite commands`

---

### Task 7: User commands (user-me, user-update)

**Files:**
- Modify: `src/client.ts`
- Modify: `src/lib/filters.ts` — add `filterUser`
- Create: `src/commands/user.ts` — 2 commands
- Modify: `src/index.ts`

**Step 1:** Add filter:

```typescript
export function filterUser(user: any) {
  return {
    id: user.id, name: user.name, email: user.email,
    role: user.role, locale: user.locale, createdAt: user.createdAt,
  };
}
```

**Step 2:** Client methods: `getCurrentUser`, `updateUser`.

**Step 3:** Create `src/commands/user.ts`:
- `user-update` flags: `[--name]`, `[--email]`, `[--avatar-url]`, `[--full-page-width]`, `[--page-edit-mode]` (choices: read/edit), `[--locale]`

**Step 4:** Register. Build. Commit: `feat: add user commands`

---

### Task 8: Space commands (10 commands)

**Files:**
- Modify: `src/client.ts` — add space CRUD + member methods
- Create: `src/commands/space.ts` — 10 commands
- Modify: `src/index.ts`
- Modify: `src/commands/page.ts` — move `space-list` out

**Step 1:** Client methods: `getSpaceInfo`, `createSpace`, `updateSpace`, `deleteSpace`, `exportSpace`, `getSpaceMembers`, `addSpaceMembers`, `removeSpaceMember`, `changeSpaceMemberRole`.

For `exportSpace`: use `{ responseType: "arraybuffer" }` for binary response.

**Step 2:** Create `src/commands/space.ts`. Move `space-list` from page.ts.
- `space-member-add --role` uses `.choices(["admin", "writer", "reader"])`, `[--user-ids]`, `[--group-ids]` (CLI sends `[]` if omitted)
- `space-member-remove` and `space-member-role` accept `(--user-id or --group-id)`
- `space-export` writes binary to `--output` file or stdout

**Step 3:** Register. Build. Commit: `feat: add space commands (10 total)`

---

### Task 9: Group commands (8 commands)

**Files:**
- Modify: `src/client.ts`
- Create: `src/commands/group.ts` — 8 commands
- Modify: `src/index.ts`
- Modify: `src/commands/page.ts` — move `group-list` out

**Step 1:** Client methods: `getGroupInfo`, `createGroup` (with optional `userIds`), `updateGroup`, `deleteGroup`, `getGroupMembers`, `addGroupMembers`, `removeGroupMember`.

**Step 2:** Create `src/commands/group.ts`. Move `group-list` from page.ts.
- `group-create [--user-ids]` seeds initial members
- `group-member-add --user-ids` supports comma-separated or stdin

**Step 3:** Register. Build. Commit: `feat: add group commands (8 total)`

---

## Phase 2: New Entity Commands

### Task 10: Comment commands (5 commands)

**Files:**
- Modify: `src/client.ts`
- Modify: `src/lib/filters.ts` — add `filterComment`
- Create: `src/commands/comment.ts`
- Modify: `src/index.ts`

**Step 1:** Add filter:

```typescript
export function filterComment(comment: any) {
  return {
    id: comment.id, pageId: comment.pageId, content: comment.content,
    selection: comment.selection, parentCommentId: comment.parentCommentId,
    creatorId: comment.creatorId, createdAt: comment.createdAt, updatedAt: comment.updatedAt,
  };
}
```

**Step 2:** Client methods. `createComment`/`updateComment` convert markdown → ProseMirror JSON:

```typescript
async createComment(pageId: string, content: string, selection?: string, parentCommentId?: string) {
  await this.ensureAuthenticated();
  const prosemirrorJson = this.markdownToProseMirrorJson(content);
  const response = await this.client.post("/comments/create", {
    pageId, content: JSON.stringify(prosemirrorJson),
    ...(selection && { selection }),
    ...(parentCommentId && { parentCommentId }),
  });
  return response.data;
}
```

Extract `markdownToProseMirrorJson` as a shared method on DocmostClient (reuses tiptap pipeline from `src/lib/tiptap-extensions.ts`).

**Step 3:** Create `src/commands/comment.ts`:
- `comment-create --content` uses `resolveContentInput()` (stdin/@file/literal)
- `[--selection]` for inline comments, `[--parent-comment-id]` for replies

**Step 4:** Register. Build. Commit: `feat: add comment commands (5 new)`

---

### Task 11: Share commands (6 commands)

**Files:**
- Modify: `src/client.ts`
- Modify: `src/lib/filters.ts` — add `filterShare`
- Create: `src/commands/share.ts`
- Modify: `src/index.ts`

**Step 1:** Add filter:

```typescript
export function filterShare(share: any) {
  return {
    id: share.id, pageId: share.pageId,
    includeSubPages: share.includeSubPages,
    searchIndexing: share.searchIndexing, createdAt: share.createdAt,
  };
}
```

**Step 2:** Client methods: `getShares`, `getShareInfo(shareId)`, `getShareForPage(pageId)`, `createShare`, `updateShare(shareId, ...)`, `deleteShare(shareId)`.

**Step 3:** Create `src/commands/share.ts`:
- `share-info` takes `--share-id`
- `share-for-page` takes `--page-id`
- `share-create/update` have `[--include-subpages]`, `[--search-indexing]` boolean flags
- `share-update/delete` take `--share-id`

**Step 4:** Register. Build. Commit: `feat: add share commands (6 new)`

---

### Task 12: Page extension commands (page-tree, move-to-space, export, import, import-zip)

**Files:**
- Modify: `src/client.ts` — add `getPageTree`, `movePageToSpace`, `exportPage`, `importPage`, `importZip`
- Modify: `src/commands/page.ts` — add 5 new commands

**Step 1:** Add `import { createReadStream } from "fs";` to top of `src/client.ts`.

**Step 2:** Client methods:

```typescript
async getPageTree(spaceId?: string, pageId?: string) {
  await this.ensureAuthenticated();
  if (!spaceId && !pageId) throw new Error("At least one of spaceId or pageId is required");
  const payload: Record<string, string> = {};
  if (spaceId) payload.spaceId = spaceId;
  if (pageId) payload.pageId = pageId;
  const response = await this.client.post("/pages/sidebar-pages", { ...payload, page: 1 });
  return response.data?.data?.items ?? [];
}

async movePageToSpace(pageId: string, spaceId: string) {
  await this.ensureAuthenticated();
  const response = await this.client.post("/pages/move-to-space", { pageId, spaceId });
  return response.data;
}

async exportPage(pageId: string, format: string, includeChildren?: boolean, includeAttachments?: boolean) {
  await this.ensureAuthenticated();
  const response = await this.client.post("/pages/export", {
    pageId, format,
    ...(includeChildren !== undefined && { includeChildren }),
    ...(includeAttachments !== undefined && { includeAttachments }),
  }, { responseType: "arraybuffer" });
  return response.data;
}

async importPage(filePath: string, spaceId: string) {
  await this.ensureAuthenticated();
  const form = new FormData();
  form.append("spaceId", spaceId);
  form.append("file", createReadStream(filePath));
  const response = await axios.post(`${this.baseURL}/pages/import`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${this.token}` },
  });
  return response.data;
}

async importZip(filePath: string, spaceId: string, source: string) {
  await this.ensureAuthenticated();
  const form = new FormData();
  form.append("spaceId", spaceId);
  form.append("source", source);
  form.append("file", createReadStream(filePath));
  const response = await axios.post(`${this.baseURL}/pages/import-zip`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${this.token}` },
  });
  return response.data;
}
```

**Step 3:** Add commands to `src/commands/page.ts`:
- `page-tree`: `[--space-id]`, `[--page-id]` — validate at least one
- `page-move-to-space`: `--page-id`, `--space-id`
- `page-export`: `--page-id`, `--export-format` `.choices(["html", "markdown"])`, `[--output]`, `[--include-children]`, `[--include-attachments]`
- `page-import`: `--file`, `--space-id`
- `page-import-zip`: `--file`, `--space-id`, `--source` `.choices(["generic", "notion", "confluence"])`

Export: write to `--output` file or stdout.

**Step 4:** Refactor `page-create`:
- Remove import workaround from createPage client method
- New `createPage` uses REST `POST /pages/create` with `{ spaceId, title?, icon?, parentPageId? }`
- Returns created page metadata (no content)
- Old behavior preserved via `page-import` command

**Step 5:** Build. Commit: `feat: add page extension commands + refactor page-create`

---

### Task 13: File and search commands

**Files:**
- Create: `src/commands/file.ts` — 2 commands
- Create: `src/commands/search.ts` — 2 commands (move `search` from page.ts, add `search-suggest`)
- Modify: `src/client.ts`
- Modify: `src/index.ts`
- Modify: `src/commands/page.ts` — remove `search`

**Step 1:** Client methods:

```typescript
async uploadFile(filePath: string, pageId: string, attachmentId?: string) {
  await this.ensureAuthenticated();
  const form = new FormData();
  form.append("file", createReadStream(filePath));
  form.append("pageId", pageId);
  if (attachmentId) form.append("attachmentId", attachmentId);
  const response = await axios.post(`${this.baseURL}/files/upload`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${this.token}` },
  });
  return response.data;
}

async downloadFile(fileId: string, fileName: string) {
  await this.ensureAuthenticated();
  const response = await this.client.get(`/files/${fileId}/${fileName}`, {
    responseType: "arraybuffer",
  });
  return response.data;
}

async searchSuggest(query: string, spaceId?: string, options?: {
  includeUsers?: boolean; includeGroups?: boolean; includePages?: boolean; limit?: number;
}) {
  await this.ensureAuthenticated();
  const response = await this.client.post("/search/suggest", {
    query, ...(spaceId && { spaceId }), ...options,
  });
  return response.data;
}
```

**Step 2:** Client method for search — add `--creator-id`:

```typescript
async search(query: string, spaceId?: string, creatorId?: string) {
  await this.ensureAuthenticated();
  const response = await this.client.post("/search", {
    query, ...(spaceId && { spaceId }), ...(creatorId && { creatorId }),
  });
  // ... existing filter logic
}
```

**Step 3:** Create `src/commands/file.ts`:
- `file-upload --file --page-id [--attachment-id]`
- `file-download --file-id --file-name [--output]` — binary to file or stdout

**Step 4:** Create `src/commands/search.ts`:
- Move `search` from page.ts, update to `--query` flag + `[--creator-id]`
- Add `search-suggest --query [--space-id] [--include-users] [--include-groups] [--include-pages] [--limit]`

**Step 5:** Register. Build. Commit: `feat: add file and search commands`

---

## Phase 3: Finalization

### Task 14: Update index.ts, help text, package.json

**Files:**
- Modify: `src/index.ts` — clean up, update help examples
- Modify: `package.json` — bump version to 2.0.0

**Step 1:** Clean `src/index.ts` — should only contain: imports, program setup with global options, command registrations (10 register calls), main().

**Step 2:** Update help text examples with new command names. Update description to "Agent-first CLI for Docmost documentation platform".

**Step 3:** Remove `-o, --output` alias (transition complete).

**Step 4:** Bump version `1.2.0` → `2.0.0` (breaking: renamed all commands).

**Step 5:** Build. Commit: `feat: finalize CLI v2.0 with 65 commands`

---

### Task 15: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1:** Update:
- Project overview: 65 commands, list all 11 entity groups
- Commands section: update examples
- Key Modules table: add `src/commands/*.ts` entries
- Add agent-first design note

**Step 2:** Commit: `docs: update CLAUDE.md for CLI v2.0`

---

## Summary

| Phase | Tasks | What | Commands |
|-|-|-|-|
| 0: Infra | 1-3 | Extract cli-utils, rename 17 commands, paginateAll maxItems | 17 (renamed) |
| 1: Admin | 4-9 | Workspace (3) + members (3) + invites (6) + users (2) + spaces (10) + groups (8) | +32 = 49 |
| 2: Entities | 10-13 | Comments (5) + shares (6) + page ext (5) + files (2) + search (1) | +19 = 65* |
| 3: Finalize | 14-15 | Help text, CLAUDE.md, version 2.0.0 | 65 |

*Note: `search` moves from page.ts to search.ts (not new), `search-suggest` is +1 new. `workspace-info`, `space-list`, `group-list` move to their respective modules (not new). Net new commands: 48.

Total: **15 tasks**, **65 commands**.

Command module files (10):
- `src/commands/workspace.ts` — workspace (3) + members (3) = 6
- `src/commands/invite.ts` — invites (6)
- `src/commands/user.ts` — users (2)
- `src/commands/space.ts` — spaces (10)
- `src/commands/group.ts` — groups (8)
- `src/commands/page.ts` — pages (18)
- `src/commands/comment.ts` — comments (5)
- `src/commands/share.ts` — shares (6)
- `src/commands/file.ts` — files (2)
- `src/commands/search.ts` — search (2)
