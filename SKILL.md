# Hearthburrow Development Workflow

## PROGRESS.md Updates

Update PROGRESS.md when user gives **positive feedback** on a completed change
(e.g., "lgtm", "looks good", "perfect", "nice", "done", "works", "great", etc.):

1. Mark the feature as ✅ (implemented) or update its status row
2. Cross-reference GDD.md — if the feature matches a GDD section, update that too
3. Remove from "Known Bugs & Issues" if the bug was fixed
4. Move from "In Progress" to "Completed" in the anchored summary section

## GDD.md Updates

Update GDD.md when the user requests an **ad-hoc change** that is a fundamental
design change not already described in the GDD:

1. Add a new subsection under the relevant GDD section (e.g., §5 Player Systems)
2. If no existing section fits, add it under a new numbered section at the end
3. Keep descriptions concise but capture: what, why, key constraints
4. ⚠️ Do NOT modify GDD sections that describe already-implemented features
   unless the user explicitly asks to redesign them

## General Rules

- Always read PROGRESS.md before starting new work to understand current state
- When implementing a feature from GDD, add it to PROGRESS.md if not already there
- Keep PROGRESS.md bug list current — add new bugs as they're discovered
- When resolving a bug, move it from "Known Bugs & Issues" to "Resolved Bugs"
  with a brief description of the fix
- Mark partially implemented features as 🟡 until fully done
- Update PROGRESS.md immediately after positive feedback
- Always ask for any uncertainties
- Give multiple options for the possible actions on uncertainties
- Commit git changes on every positive feedbacks
