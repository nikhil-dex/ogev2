# OgeNotes

OgeNotes is the production-focused evolution of the existing `ogenotes` study-notes application. The goal is to preserve the original app's visual design and reuse its working code selectively, while adding the agreed dashboard features and a secure multi-user architecture.

## Project principles

1. **Reuse before rewriting:** inspect `ogenotes`, identify reusable pages, components, styles, utilities, and working features, then port only what OgeNotes needs.
2. **Preserve the original design:** keep the same visual language, layout, responsive behavior, and interaction patterns.
3. **Keep the repositories separate:** `ogenotes` is the reference project and must not be modified as part of this work. All changes belong in `oge`.
4. **Secure multi-user data:** use Google sign-in and store application data in the project owner's MongoDB Atlas database, with server-enforced per-user access controls.
5. **No file storage in the initial release:** do not implement PDF uploads, image/file attachments, Google Drive, Vercel Blob, or another file-storage integration.

## Home dashboard scope

The dashboard will provide access to:

- Notes
- AirNotes
- Quick Notes
- Saved Links
- Browser Extension
- Revision History
- Dictionary
- News
- Revision

During registration, users can optionally select news interests. They can change these interests later in settings. Users who skip this step should still receive a general news feed.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the phased implementation plan, release gates, and acceptance criteria.

## Current status

The dashboard, Google sign-in scaffolding, news-interest onboarding, and MongoDB foundation are merged into `main`. The core-workspace milestone is on `implementation/notes-module`: it adds owner-scoped Notes, Quick Notes, AirNotes, and Saved Links APIs/workspaces, plus initial Revision/Revision History, personalized News, Dictionary, and a Manifest V3 browser-extension MVP. The extension uses a revocable 90-day token; a manual Chrome smoke test and runtime multi-account isolation tests are still required. It includes bounded request bodies, URL validation, tags, favorites, owner-scoped review scheduling, and previous-version snapshots. This is a first implementation, not full parity with every advanced feature in `ogenotes`; multi-account security tests and live app validation remain required. See [ROADMAP.md](./ROADMAP.md) and [Google OAuth setup](./docs/GOOGLE_AUTH_SETUP.md).

## Security and configuration

- Never commit secrets, OAuth credentials, database connection strings, session secrets, or production environment files.
- Keep database access and privileged operations on the server.
- Do not deploy publicly until the release gates in `ROADMAP.md` have passed.

## Customs library (personal GitHub Vault)

Each user can create a **`customs/`** folder at the root of their own private `ogenotes-vault` GitHub repository and commit HTML, PDF or image files to it. No change to the OgeV2 application source repository is needed.

After signing in with their connected GitHub Vault, the OgeV2 homepage displays a **Customs** module. Opening it scans the Vault repository and lists supported top-level files (.html, .htm, .pdf, .png, .jpg, .jpeg, .webp, .gif, .avif) on the Customs page. Clicking a file opens it in a new tab through an authenticated, read-only OgeV2 endpoint. Files are not published from the app's `public/` directory.

The module remains visible to connected GitHub Vault users even if their `customs/` folder does not exist. An empty folder must contain at least one committed file to be present in Git, such as a `.gitkeep`; otherwise Git does not track it. Files above 10 MiB and unsupported formats are not displayed. HTML previews run with a restricted sandbox; some external resources or scripts may not work. The browser must be signed in to view the files.

## Indexed Customs module

For users with GitHub Vault selected and connected, OgeV2 shows a **Customs** module on the home screen even if their personal GitHub Vault repository has no `customs/` folder yet. It is hidden from MongoDB-only and disconnected accounts. Open Customs to scan for files. The first visit creates a MongoDB **metadata-only index** linked to your own Vault repo; the app never copies the file bytes into MongoDB. Scans are refreshed after approximately 60 seconds or instantly with **Refresh files**. If the folder is absent, the Customs page explains how to create it at the root of your private `ogenotes-vault` repository.

## GitHub Vault study, offline read fallback and backup

On the `feature/vault-study-reliability` branch, GitHub Vault owners with the Notes preview enabled can use `/vault/study` for recall sessions and spaced-repetition due dates, or `/vault/history` to view recent committed GitHub revisions and restore a chosen prior version. Ratings, next-review times and review counts live in MongoDB **without note bodies**. Current Notes remain GitHub-owned.

Recently fetched Vault Notes can be viewed from a small, 24-hour, tab-scoped `sessionStorage` copy when a later GitHub read fails. The app switches to read-only mode instead of pretending the offline copy can be saved directly to GitHub. This is not a full offline PWA, and no pending offline edits are silently replayed.

`/vault/backup` summarizes the currently committed repository tree and links to the complete native GitHub ZIP download. It includes a **manual** recovery guide. Full Oge-managed ZIP restore and independent verification of a downloaded ZIP are still pending.
