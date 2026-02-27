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
  Use when user wants to manage documentation in Docmost — create/read/update/delete pages,
  search content, organize spaces, view page history, manage trash.
  Trigger on requests about documentation pages, knowledge base, wiki, spaces, page content,
  Docmost workspace.
---

# docmost

Docmost CLI skill for AI agents.

## Install

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

- Always add `--output json` for agent workflows.
- Prefer env vars for credentials over CLI flags (`--password` is visible in process lists).
- Auth precedence: `--token` > `DOCMOST_TOKEN` > `--email/--password` > `DOCMOST_EMAIL/DOCMOST_PASSWORD`.
- For content input, prefer `--content @file.md` or `--content -` (stdin) over inline strings for multi-line content.
- Use `--output text` only when the user explicitly wants raw markdown content (e.g. `get-page`, `page-history-detail`).
- Use `--output table` for human-readable list displays when the user asks.
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
docmost move-page --page-id <pageId> --root --output json
docmost duplicate-page --page-id <pageId> --output json
docmost duplicate-page --page-id <pageId> --space-id <targetSpaceId> --output json
docmost breadcrumbs --page-id <pageId> --output json
```

### Search

```bash
docmost search "query text" --output json
docmost search "query text" --space-id <spaceId> --output json
```
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
- "создай страницу в Docmost"
- "обнови документацию"
- "найди в вики страницу про API"
- "покажи все пространства"
- "удали черновик"
- "перенеси страницу в другой раздел"
- "покажи историю страницы"

### Should not trigger

- General file editing unrelated to Docmost
- Git operations
- Non-documentation tasks
```

**Step 2: Commit**

```bash
git add SKILL.md
git commit -m "feat(SKILL.md): add trigger examples"
```

---

### Task 9: Final review and squash-ready

**Step 1: Read the full SKILL.md and verify**

- All 17 commands present
- Consistent formatting
- No broken markdown
- Examples use `--output json` consistently

**Step 2: Done**

No additional commit needed — file is complete.
