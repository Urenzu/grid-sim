Review all staged and unstaged changes, then:

1. Stage all relevant changed files (skip .env, credentials, secrets)
2. Create a commit with a concise, well-written message describing the changes
3. Push to the current branch (create remote tracking branch with -u if needed)
4. Create a PR using `gh pr create` targeting main with:
   - A short descriptive title
   - A body summarizing the changes and a test plan
   - No emojis anywhere in the title or body
   - No "Generated with Claude Code" or similar attribution text

If there's no remote or gh is not available, stop after the push and let me know.
Do not force push. If the push fails, stop and tell me why.

$ARGUMENTS
