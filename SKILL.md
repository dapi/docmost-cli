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

## Execution Rules

- If `docmost` is not found, install it: `npm install -g github:dapi/docmost-cli`.
- Always add `--output json` for agent workflows.
- Prefer env vars for credentials over CLI flags (`--password` is visible in process lists).
- Auth precedence: `--token` > `DOCMOST_TOKEN` > `--email/--password` > `DOCMOST_EMAIL/DOCMOST_PASSWORD`.
- For content input, prefer `--content @file.md` or `--content -` (stdin) over inline strings for multi-line content.
- `--output text` supported only by: `get-page`, `page-history-detail`. Use when user wants raw markdown.
- `--output table` supported by: `workspace`, `list-spaces`, `list-groups`, `list-pages`, `get-page`, `search`, `page-history`, `page-history-detail`, `trash`, `delete-pages`, `breadcrumbs`. Use for human-readable displays.
- Commands not listed above support only `--output json`.

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
