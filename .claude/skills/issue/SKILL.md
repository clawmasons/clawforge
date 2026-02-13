---
name: issue
description: Open a GitHub issue on the current project with analysis and planning
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash(gh issue create *), AskUserQuestion
argument-hint: "[description of the issue]"
---

# /issue — Create a GitHub Issue

Do not make any changes to the repo while researching and opening an issue.  
If you are unsure, include suggested changes in the plan and the changes will
be attempted during the pr

## Phase 1: Analysis

Read the following files (skip any that don't exist):
- `README.md`
- `ARCHITECTURE.md`
- `tasks/lessons.md`

Use these to understand the project's context, structure, and conventions.

Then analyze the user's request: **$ARGUMENTS**

## Phase 2: Draft

Generate a draft GitHub issue with:
- **Title**: concise, imperative (e.g. "Add dark mode support")
- **Body**: GitHub-flavored markdown with:
  - A clear problem/feature description
  - Relevant context from the codebase analysis
  - Acceptance criteria as a checklist

Present the draft to the user.

## Phase 3: First Checkpoint

Use `AskUserQuestion` to ask the user what to do next with these 3 choices:

1. **Open issue** — Create the issue on GitHub as-is
2. **Create detailed plan** — Expand into a step-by-step implementation plan before opening
3. **Chat about changes** — Let the user refine the description conversationally

### If "Open issue" is selected → go to Phase 5

### If "Chat about changes" is selected → let the user iterate freely, then re-prompt with Phase 3

### If "Create detailed plan" is selected → continue to Phase 4

## Phase 4: Plan Expansion

Analyze the codebase using `Glob`, `Grep`, and `Read` to identify the files and areas that would need to change. Then expand the issue body with a detailed implementation plan:

- Step-by-step breakdown of changes needed
- Files to modify or create
- Key considerations or risks

Present the updated draft, then use `AskUserQuestion` with 2 choices:

1. **Open issue** — Create the issue on GitHub
2. **Chat about changes** — Refine conversationally, then re-prompt with this same checkpoint

## Phase 5: Create Issue

Run `gh issue create` using Bash with the final title and body. Use a HEREDOC for the body to preserve formatting:

```
gh issue create --title "The title" --body "$(cat <<'EOF'
The body content here
EOF
)"
```

Display the resulting issue URL to the user.
