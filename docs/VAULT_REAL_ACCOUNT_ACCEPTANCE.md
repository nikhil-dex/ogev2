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


## Notes parity acceptance — PR #7

Run these checks on `feature/notes-parity-simple` in a signed-in, connected private GitHub Vault. These steps must be marked **NOT RUN** until executed with a real account.

| Feature | Real-user action | Expected |
|---|---|---|
| Pinning | Pin and unpin a Note; filter pinned; reload | Pinned order and filter are consistent in GitHub Vault |
| Links and reader navigation | Create `[[Arrays]]` in a Note in Mathematics and an Arrays Note in another subject; open backlinks and select **Check links in entire Vault**, open the result | Links across subjects are found; previous/next, keyboard arrows and mobile swipe remain available in the linked Note |
| Gemini | Configure your own Gemini key; open a committed Note and run cleanup; review but do not Save, then retry and Save | Suggestion appears without committing automatically; only pressing Save writes GitHub |
| PDF | Export a Note containing headings, lists, code blocks, tables and Unicode; open saved PDF under My Files | PDF opens and content is legible, with a structured readable layout; browser Print is still available |
| Study | Set a daily goal; review two different Notes; open Study in another signed-in device | Goal and unique completed Notes match across devices; no Note bodies are stored in MongoDB |
| Offline reload | Open a committed Note, disconnect, edit and close/reload the app while the shell is available; reconnect | Browser draft is recoverable; pending change requires Review & Sync |
| Offline conflict | Edit a Note offline, update its GitHub version on another device, reconnect and choose **Keep both** | Two Notes survive; neither version is silently overwritten |
| Uncertain save | Interrupt a Note Save after the request might have reached GitHub; reconnect | If GitHub already contains identical content, queue recognizes **Already saved** and can be safely cleared |

**Limitations:** Browser-local unsaved drafts are not backed up across devices; the app cannot cold-start fully offline without the application shell. Successful CI does not certify these real-user cases.

## Local commands

```bash
npm install
npm run dev
npm test
npm run test:browser
```

Development branch: `feature/vault-recovery-offline-acceptance`. These tests should be performed before merging or deploying this feature branch.
