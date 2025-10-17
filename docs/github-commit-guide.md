# Committing Local Changes to GitHub

Follow these steps to push the latest updates from your local checkout to GitHub:

1. **Review your work**
   - Run `git status` to confirm which files changed.
   - Run `git diff` (or `git diff <file>`) to double-check the modifications.

2. **Stage the changes**
   - Use `git add <file>` for specific files, or `git add .` to stage everything.

3. **Run project checks**
   - Execute the project linting or test commands. For this repo:
     - `pnpm lint`
     - `pnpm typecheck`

4. **Commit**
   - Commit with a concise, descriptive message:
     ```bash
     git commit -m "<short summary of changes>"
     ```

5. **Sync with the remote main branch (optional but recommended)**
   - Fetch the latest remote changes: `git fetch origin`
   - Rebase or merge if needed: `git rebase origin/main` (or `git merge origin/main`)

6. **Push to GitHub**
   - Push the branch: `git push origin <branch-name>`

7. **Open a Pull Request**
   - Visit the repository on GitHub. You should see a prompt to open a PR for your branch.
   - Provide a summary of the changes, testing performed, and any context reviewers need.

8. **Monitor CI and feedback**
   - Ensure automated checks pass.
   - Address any review feedback by repeating the cycle: edit → test → commit → push.

