# Milestone #136 — Real-account acceptance checklist

Use a **non-critical signed-in account and its own private `ogenotes-vault`** in a local or staging OgeV2 instance. These require a real GitHub OAuth/installation and browser-extension session; they **cannot** be certified by synthetic CI tests. Do not expose OAuth tokens, private Notes or repository links in test reports.

| Scenario | Action to perform with the actual account | Expected outcome |
|---|---|---|
| GitHub sign-in | Sign out, sign in using GitHub, then reload | Correct user profile; no account mismatch |
| Connect a Vault | Open Vault setup, authorize GitHub App, connect personal private `ogenotes-vault` | Account displays connected Vault |
| Create a Note | Add subject, create a Note, Save; reload in another tab | Correct Note appears, backed by private GitHub repo |
| Extension capture | Sign into extension; save selection/page to Quick Notes and to an existing subject | Quick Notes/Notes reflect correct owner, extension shows confirmation |
| Customs | Commit `customs/test.html`, `customs/test.pdf` in the private Vault; open Customs and press Refresh | Correct files listed and opened for the signed-in owner |
| Revision restore | Edit and save a Note twice; open Vault History and restore an earlier version | New GitHub commit restores chosen content without modifying other Notes |
| My Files | Upload and open one PDF, DOCX, PNG and JPG; download each | Authenticated preview and original download work, including browser-private Word text preview |
| Backup | Download full Vault ZIP, open Backup, select ZIP, inspect counts and existing-file conflicts | Preview shows categories; existing files are not overwritten |
| Recovery | Make a temporary file, include in ZIP, remove it from GitHub, then select ZIP and restore | Only missing file reappears; all pre-existing files remain unchanged |
| Offline edits | Load Note, switch browser network offline, edit and Save offline; reconnect | Local queue visible, review required; no silent auto-sync |
| Conflict | After offline edit, update same Note from second tab/device; reconnect and review | Shows both versions; user explicitly chooses or discards; no silent overwrite |

Record each scenario as **PASS**, **FAIL** or **NOT RUN** along with browser, time and a redacted error. Do not mark Milestone #136 complete until those actual-user scenarios pass. Existing CI verifies only synthetic workflows and can run without GitHub credentials.

## Local commands

```bash
npm install
npm run dev
npm test
npm run test:browser
```

Development branch: `feature/vault-recovery-offline-acceptance`. These tests should be performed before merging or deploying this feature branch.
