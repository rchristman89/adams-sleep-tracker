# Dev Process (Ryan's rules)

This repo follows a strict issue → branch → PR → review → merge workflow.

## 0) Always start from an Issue
- Pick the next issue in the MVP milestone.
- **Assign the issue to `rchristman89`.**
- Add a short comment like: "Starting work in branch `<branch>`".

## 1) Create a branch linked to the issue
Branch naming:
- `issue-<num>-<slug>` (example: `issue-5-twilio-inbound-webhook`)

Commands:
```bash
git checkout main
git pull
git checkout -b issue-5-twilio-inbound-webhook
```

## 2) Do the work
- Commit early and clearly.
- Push branch to origin.

## 3) Open a PR
- PR title should reference the issue: `#5 Twilio inbound webhook`.
- PR description:
  - What changed
  - How to test
  - Checklist (env vars, deployment notes)

## 4) Request Copilot review (required)
Use `gh` to request review from Copilot (or Copilot review alias).

Example:
```bash
gh pr create --fill
# then request review
gh pr edit <pr> --add-reviewer @github-copilot
```

(If the org/user reviewer name differs, adjust accordingly.)

## 5) Address review comments (required)
- Read each comment.
- For each one: **reply** with either:
  - **Accepting**: implement the change, mention what you changed
  - **Denying**: explain why not (technical reason, out of scope, etc.)

No silent resolutions.

## 6) Wait for CI
- Do **not** merge until GitHub Actions checks are green.

## 7) Merge and close the loop
- Merge PR (squash preferred unless noted).
- Ensure the issue is closed (auto-close via PR "Fixes #<n>" is preferred).
- Move to the next issue.

---

## Notes / Improvements
- Future repos should copy this file as the default workflow.
- If we add a GitHub Project board, issues should also be moved across columns.
