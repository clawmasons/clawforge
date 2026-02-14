---
name: fix
description: Fix a GitHub issue — pull details, plan, implement, verify, and optionally open a PR
allowed-tools: Read, Grep, Glob, Write, Edit, Bash, AskUserQuestion, EnterPlanMode, ExitPlanMode, Task
argument-hint: "<issue-number>"
---
user may type in more things than issue number, find a number and assume it is ISSUE_NUMBER moving forward

Write out a tasks/todo.md with the tasks in this skill and keep track if you have done all the steps.

# /fix — Fix a GitHub Issue

Fix a GitHub issue end-to-end: fetch details, plan the fix, implement it, verify it, and optionally open a PR.

## Phase 1: Fetch Issue

Run `gh issue view ISSUE_NUMBER --json title,body,labels,assignees` using Bash to pull the issue details.

Display the issue title and body to the user.

## Phase 2: Branch Strategy

Use `AskUserQuestion` to ask the user how they want to work on this fix with these 3 choices:

1. **Create branch** — Create a new branch `issue-ISSUE_NUMBER-<oneworddescription>` (derive the one-word description from the issue title) and check it out
2. **Fix on current branch** — Stay on the current branch and fix it here
3. **Let's chat** — Discuss the issue before deciding on an approach

### If "Create branch" is selected
Run `git checkout -b issue-ISSUE_NUMBER-<oneworddescription>` using Bash, then continue to Phase 3.

### If "Fix on current branch" is selected
Continue to Phase 3.

### If "Let's chat" is selected
Let the user discuss freely, then re-prompt with Phase 2 when ready.

## Phase 3: Plan the Fix

Read the following files for context (skip any that don't exist):
- `CLAUDE.md`
- `ARCHITECTURE.md`
- `README.md`
- `tasks/lessons.md`

Enter plan mode using `EnterPlanMode`. In plan mode:

1. Analyze the issue details against the codebase
2. Use `Glob`, `Grep`, and `Read` to explore relevant code
3. Identify root cause (for bugs) or implementation approach (for features)
4. Write a detailed plan covering:
   - Problem analysis / root cause
   - Step-by-step implementation changes
   - Files to modify or create
   - Verification strategy (how to prove the fix works)
   - Risks or considerations

Exit plan mode with `ExitPlanMode` to present the plan for user approval.

## Phase 4: Write Plan to Disk

Once the user approves the plan, create the `tasks/` directory if it doesn't exist, then write the plan to `tasks/issue-ISSUE_NUMBER-plan.md` with the following format using future tense since this is something that is going to happen next:

```markdown
# Issue ISSUE_NUMBER: <issue title>

## Problem
<description of the problem or feature>

## Plan
<the approved implementation plan>

## Verification
<how correctness will be verified>

## Status
- [ ] Implementation
- [ ] Verification
- [ ] PR (optional)
```

## Phase 5: Implement the Fix

Execute the plan step by step. After each meaningful change:

1. Verify the change works (run tests, check logs, build, or demonstrate correctness as appropriate)
2. If verification fails, debug and fix before moving on
3. Do not mark a step complete until it is verified

Follow the verification strategy from the plan. At minimum:
- Run any relevant tests (`pnpm test`, `pnpm build`, etc.)
- Confirm the fix addresses the issue's acceptance criteria

Update `tasks/issue-ISSUE_NUMBER-plan.md` to check off completed items.

## Phase 6: Final Verification

run the '/test' skill

Once all implementation steps are done, run a final round of verification:
- Build the affected packages
- Run tests if they exist
- Manually confirm the fix addresses the original issue

Update `tasks/issue-ISSUE_NUMBER-plan.md` to mark verification complete.

## Phase 7: PR Decision

Use `AskUserQuestion` to ask the user:

1. **Create PR** — Generate a PR description and open a pull request
2. **Done for now** — Stop here without opening a PR

### If "Done for now" is selected
Display a summary of what was done and stop.

### If "Create PR" is selected
Continue to Phase 8.

## Phase 8: Create Pull Request

1. Write `tasks/issue-ISSUE_NUMBER-pr.md` with a PR summary:

```markdown
# PR for Issue #ISSUE_NUMBER: <issue title>

## Summary
<1-3 bullet points describing the changes>

## Changes
<list of files changed and what was modified>

## Test Plan
<how the fix was verified>

## Issue
Fixes #ISSUE_NUMBER
```

2. Add the plan as a comment on the GitHub issue:

use the plan as it was written before the implementation.  Future tense for the plan. 
We want to see what what the plan was in the issue comment.

```
gh issue comment ISSUE_NUMBER --body "$(cat <<'EOF'
## Implementation Plan

<contents of the plan from tasks/issue-ISSUE_NUMBER-plan.md>

## Plan Modifications

<quick summary to modifications to the plan that were made>

EOF
)"

```



3. Push the branch and open a PR:

use markdown syntax on the title to make a link to the issue

```
git push -u origin HEAD
```

```
gh pr create --title "<issue-ISSUE_NUMBE> <concise title>]" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Changes
<files changed>

## Test Plan
<verification steps>

Fixes #ISSUE_NUMBER

---
EOF
)"
```

Display the resulting PR URL to the user.
