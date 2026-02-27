# Design: SKILL.md for docmost CLI

## Purpose

AI skill file for Claude Code and other AI agents. Enables agents to manage Docmost documentation via CLI commands.

## Approach

Mirror tgcli SKILL.md structure — proven format that agents already work well with.

## Structure

### 1. YAML Front Matter
- name: `docmost`
- description: triggers on documentation/wiki/pages/spaces/knowledge base requests

### 2. Install
- `npm install -g github:dapi/docmost-cli`
- Auth: env vars DOCMOST_API_URL + DOCMOST_TOKEN or DOCMOST_EMAIL/DOCMOST_PASSWORD

### 3. Execution Rules
- Always `--output json` for agent workflows
- Prefer env vars for credentials (not CLI flags)
- Content input: `--content @file.md` or `--content -` (stdin) over inline strings
- Default output format is json, use `--output text` only when user wants raw markdown content

### 4. Core Command Patterns (all 17 commands)
- **Workspace**: `workspace`
- **Spaces**: `list-spaces`
- **Groups**: `list-groups`
- **Pages CRUD**: `list-pages`, `get-page`, `create-page`, `update-page`, `delete-page`, `delete-pages`
- **Organization**: `move-page`, `duplicate-page`, `breadcrumbs`
- **Search**: `search`
- **History**: `page-history`, `page-history-detail`, `restore-page`
- **Trash**: `trash`

Each command with full bash example including typical flags.

### 5. CRUD Workflow
Step-by-step: discover spaces → list pages → read/create/update → verify

### 6. Trigger Examples
Should trigger (EN + RU) / should not trigger

## Decisions

- No tool boundary section (CLI is the only tool)
- Focus on CRUD workflows (no migration/analytics)
- Skill name: `docmost`
