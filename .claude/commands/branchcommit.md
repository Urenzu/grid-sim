Create a new branch from the current state and push it. Follow these rules strictly:

1. Run `git status` and `git diff --stat` to understand what changed
2. Pick a short, lowercase, hyphenated branch name that describes the changes (e.g. `fix-auth-redirect`, `add-color-pickers`). If the user provides a name via $ARGUMENTS, use that instead
3. Create the branch with `git checkout -b <name>`
4. Stage all relevant changed files (skip .env, credentials, secrets, and build artifacts)
5. Write a commit message that is:
   - One short subject line (imperative mood, under 72 chars)
   - Optionally a blank line followed by 1-2 sentences of context if needed
   - No emojis
   - No co-author lines
   - No "Generated with Claude Code" or similar attribution
6. Commit and push with `git push -u origin <branch>`

Do not force push. Do not amend existing commits. If the push fails, stop and explain why.

$ARGUMENTS
