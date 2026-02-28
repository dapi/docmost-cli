# SKILL.md Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create SKILL.md — AI agent skill file for docmost CLI, covering all 17 commands with examples and workflows.

**Architecture:** Single markdown file with YAML front matter. Mirrors tgcli SKILL.md structure: front matter → install → execution rules → command patterns → workflow → triggers.

**Tech Stack:** Markdown, YAML front matter

---

### Task 1: Create SKILL.md with front matter and install section

**Files:**
- Create: `SKILL.md`

**Step 1: Write the file**

Create `SKILL.md` with:

```markdown
---
name: docmost
description: >
  Use when user wants to create/read/update/delete pages in Docmost via docmost CLI,
  search documentation content, list/organize spaces, view page history, restore from trash.
  Trigger on requests about documentation pages, knowledge base, wiki, spaces, page content,
  Docmost workspace, page versions, page hierarchy.
---

# docmost

Docmost CLI skill for AI agents.

## Install

Install this skill from GitHub:

```bash
npx skills add dapi/docmost-cli --skill docmost --agent '*' -g -y
```

Install CLI:

```bash
npm install -g github:dapi/docmost-cli
```

Set environment variables:

```bash
export DOCMOST_API_URL=http://your-instance/api
export DOCMOST_TOKEN=<token>
# or use email/password:
export DOCMOST_EMAIL=<email>
export DOCMOST_PASSWORD=<password>
```
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat: add SKILL.md skeleton with front matter and install"
```

---

### Task 2: Add Execution Rules section

**Files:**
- Modify: `SKILL.md`

**Step 1: Append Execution Rules**

After install section, add:

```markdown
## Execution Rules

- If `docmost` is not found, install it: `npm install -g github:dapi/docmost-cli`.
- Always add `--output json` for agent workflows.
- Prefer env vars for credentials over CLI flags (`--password` is visible in process lists).
- Auth precedence: `--token` > `DOCMOST_TOKEN` > `--email/--password` > `DOCMOST_EMAIL/DOCMOST_PASSWORD`.
- For content input, prefer `--content @file.md` or `--content -` (stdin) over inline strings for multi-line content.
- `--output text` supported only by: `get-page`, `page-history-detail`. Use when user wants raw markdown.
- `--output table` supported by: `workspace`, `list-spaces`, `list-groups`, `list-pages`, `get-page`, `search`, `page-history`, `page-history-detail`, `trash`, `delete-pages`, `breadcrumbs`. Use for human-readable displays.
- Commands not listed above support only `--output json`.
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat(SKILL.md): add execution rules"
```

---

### Task 3: Add Core Command Patterns — Workspace, Spaces, Groups

**Files:**
- Modify: `SKILL.md`

**Step 1: Append commands**

```markdown
## Core Command Patterns

### Workspace

```bash
docmost workspace --output json
```

### Spaces

```bash
docmost list-spaces --output json
```

### Groups

```bash
docmost list-groups --output json
```
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat(SKILL.md): add workspace/spaces/groups commands"
```

---

### Task 4: Add Core Command Patterns — Pages CRUD

**Files:**
- Modify: `SKILL.md`

**Step 1: Append pages commands**

```markdown
### Pages

```bash
docmost list-pages --output json
docmost list-pages --space-id <spaceId> --output json
docmost get-page --page-id <pageId> --output json
docmost get-page --page-id <pageId> --output text
docmost create-page --title "Page Title" --content @content.md --space-id <spaceId> --output json
docmost create-page --title "Sub Page" --content "# Hello" --space-id <spaceId> --parent-page-id <parentId> --output json
echo "# Content from stdin" | docmost create-page --title "From Pipe" --content - --space-id <spaceId> --output json
docmost update-page --page-id <pageId> --content @updated.md --output json
docmost update-page --page-id <pageId> --content @updated.md --title "New Title" --output json
docmost delete-page --page-id <pageId> --output json
docmost delete-page --page-id <pageId> --permanent --output json
docmost delete-pages --page-ids "id1,id2,id3" --output json
```

Content input accepts three forms: literal string, `@path/to/file.md` (file), or `-` (stdin pipe).

Note: `delete-page` supports `--permanent` for hard delete; `delete-pages` always soft-deletes to trash.
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat(SKILL.md): add pages CRUD commands"
```

---

### Task 5: Add Core Command Patterns — Organization, Search

**Files:**
- Modify: `SKILL.md`

**Step 1: Append commands**

```markdown
### Page Organization

```bash
docmost move-page --page-id <pageId> --parent-page-id <targetParentId> --output json
docmost move-page --page-id <pageId> --parent-page-id <targetParentId> --position <pos> --output json
docmost move-page --page-id <pageId> --root --output json
docmost duplicate-page --page-id <pageId> --output json
docmost duplicate-page --page-id <pageId> --space-id <targetSpaceId> --output json
docmost breadcrumbs --page-id <pageId> --output json
```

`--root` and `--parent-page-id` are mutually exclusive. `--position` is a 5-12 char string for ordering within the parent.

### Search

```bash
docmost search "query text" --output json
docmost search "query text" --space-id <spaceId> --output json
```

Note: query is a positional argument, not a flag.
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat(SKILL.md): add organization and search commands"
```

---

### Task 6: Add Core Command Patterns — History, Trash

**Files:**
- Modify: `SKILL.md`

**Step 1: Append commands**

```markdown
### History

```bash
docmost page-history --page-id <pageId> --output json
docmost page-history --page-id <pageId> --cursor <cursor> --output json
docmost page-history-detail --history-id <historyId> --output json
docmost page-history-detail --history-id <historyId> --output text
docmost restore-page --page-id <pageId> --output json
```

### Trash

```bash
docmost trash --space-id <spaceId> --output json
```
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat(SKILL.md): add history and trash commands"
```

---

### Task 7: Add CRUD Workflow

**Files:**
- Modify: `SKILL.md`

**Step 1: Append workflow**

```markdown
## CRUD Workflow

For tasks like "create a page", "update documentation", "organize pages":

1. Discover spaces:
   - `docmost list-spaces --output json`
2. List existing pages in target space:
   - `docmost list-pages --space-id <spaceId> --output json`
3. Read existing page (if updating):
   - `docmost get-page --page-id <pageId> --output text`
4. Create or update:
   - `docmost create-page --title "Title" --content @file.md --space-id <spaceId> --output json`
   - `docmost update-page --page-id <pageId> --content @file.md --output json`
5. Verify result:
   - `docmost get-page --page-id <pageId> --output json`
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat(SKILL.md): add CRUD workflow"
```

---

### Task 8: Add Trigger Examples

**Files:**
- Modify: `SKILL.md`

**Step 1: Append trigger examples**

```markdown
## Trigger Examples

### Should trigger

- "create a page in Docmost"
- "update the onboarding documentation"
- "search for API docs in wiki"
- "list all spaces"
- "delete the draft page"
- "move page under Getting Started"
- "show page history"
- "restore deleted page"
- "find pages about deployment"
- "what pages are in the Engineering space?"
- "duplicate this page to another space"
- "создай страницу в Docmost"
- "обнови документацию"
- "найди в вики страницу про API"
- "покажи все пространства"
- "удали черновик"
- "перенеси страницу в другой раздел"
- "покажи историю страницы"
- "восстанови удалённую страницу"

### Should not trigger

- Editing local files (not Docmost pages)
- Git operations, CI/CD pipelines
- Sending messages (use Slack/Telegram skills)
- Managing users or permissions (use Docmost web UI)
- Editing page comments (not supported by CLI)
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat(SKILL.md): add trigger examples"
```

---

### Task 9: Final review and squash-ready

**Step 1: Read the full SKILL.md and verify**

- All 17 commands present: workspace, list-spaces, list-groups, list-pages, get-page, create-page, update-page, delete-page, delete-pages, move-page, duplicate-page, breadcrumbs, search, page-history, page-history-detail, restore-page, trash
- Consistent formatting
- No broken markdown (especially nested code blocks)
- Examples use `--output json` consistently
- `--output text`/`--output table` support documented accurately per command

**Step 2: Done**

No additional commit needed — file is complete.
