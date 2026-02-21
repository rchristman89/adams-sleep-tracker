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
Copilot review is part of the gate — don’t merge without it (unless we explicitly agree on a timeout rule).

Use the `gh` alias **required for this repo**:
```bash
gh pr create --fill
# then request Copilot review
gh save-me-copilot rchristman89/adams-sleep-tracker <pr_number>
```

## 5) Address review comments (required)
- Read each comment.
- For each one: **reply** with either:
  - **Accepting**: implement the change, mention what you changed
  - **Denying**: explain why not (technical reason, out of scope, etc.)

No silent resolutions.

### 5a) Final Copilot re-review gate (required)
If you push changes in response to Copilot feedback:
- **Request Copilot re-review** again.
- **Before merging**, explicitly acknowledge the final Copilot re-review outcome in the PR:
  - If Copilot posts new comments → handle them (accept/deny + changes).
  - If Copilot posts a review with **no new comments** → leave a short PR comment like: "Checked final Copilot re-review on <sha>; no new findings."

## 6) Wait for CI + Copilot review
- Do **not** merge until GitHub Actions checks are green.
- Do **not** merge until Copilot review is posted and all comments are handled (accept/deny + rationale).

### 6a) Monitoring (part of the loop)
This repo treats “waiting” as an explicit step.

Options:
- **Manual:** check the PR page for CI + Copilot review.
- **Autonomous (recommended):** create a short-lived watcher that checks every couple minutes and posts status until ready, then disables itself.

## 7) Merge and close the loop
- Merge PR (squash preferred unless noted).
- Ensure the issue is closed (auto-close via PR "Fixes #<n>" is preferred).
- **Immediately start the next issue** in the MVP order (assign → branch comment → branch).

---

## Notes / Improvements
- Future repos should copy this file as the default workflow.
- If we add a GitHub Project board, issues should also be moved across columns.
