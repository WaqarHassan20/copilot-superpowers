# Plan — What to Do & How to Do It

Roadmap and sprint planning for **AI Agent Superpowers** v1.2.0 and beyond.

---

## Completed Features

- [x] **Copilot LM Tool — `aiSkills_requestSkill`** (2026-03-10)
      Implemented `src/tools/requestSkillTool.ts`. Registered in `extension.ts`. Declared in `package.json` under `contributes.languageModelTools`. Updated `copilot-instructions.md` with usage guidance.

---

## Current Version: 1.1.0

Released 2026-03-06. Stable. Published to VS Code Marketplace.

---

## Next Release: v1.2.0

**Target date:** 2026-03-20  
**Theme:** Performance, quality, and richer skill discovery

### P0 — Must Have

- [ ] **Memoize `InstallationDetector`**  
       _Problem:_ Full disk scan on every tree refresh causes lag on large setups.  
       _Solution:_ Cache install state in a `Map<string, boolean>`; invalidate only when a command writes to or deletes from an install path (hook into installer `install()`/`uninstall()` methods).  
       _Files:_ `src/skills/InstallationDetector.ts`, `src/commands/installSkill.ts`, `src/commands/uninstallSkill.ts`

- [x] **Add retry logic to `RemoteSync`** (2026-03-09)
      Implemented 3 retries with 1s/2s/4s exponential back-off; immediate null return on 4xx errors.

- [ ] **Markdown syntax highlighting in preview webview**  
       _Problem:_ Skill preview shows raw Markdown as plain text.  
       _Solution:_ Render Markdown via `vscode.commands.executeCommand('markdown.api.render', ...)` or a lightweight Marked.js inside the webview.  
       _Files:_ `src/commands/previewSkill.ts`

### P1 — Should Have

- [ ] **Monorepo workspace scan**  
       _Problem:_ `WorkspaceScanner` only reads the root `package.json`.  
       _Solution:_ Walk all `package.json` files up to 2 levels deep with `glob`; merge detected technologies.  
       _Files:_ `src/skills/WorkspaceScanner.ts`

- [ ] **Installer unit tests**  
       _Problem:_ Zero test coverage for installer classes.  
       _Solution:_ Add `test/installers/` with Jest-style mocha tests mocking `fs` operations.  
       _Files:_ `test/installers/projectLocalInstaller.test.ts`

- [ ] **Show skill `source` badge in tree**  
       _Problem:_ Users can't distinguish bundled vs remote vs local skills.  
       _Solution:_ Add a `description` property to `SkillNode` showing `[local]` or `[remote]` suffix.  
       _Files:_ `src/tree/nodes.ts`, `src/tree/SkillsTreeProvider.ts`

### P2 — Nice to Have

- [x] **Bulk uninstall by category** (2026-03-09)
      `aiSkills.uninstallCategory` and `aiSkills.uninstallCollection` commands added.

- [ ] **Skill update detection**  
       _Problem:_ If a skill's remote content is updated, users don't know.  
       _Solution:_ Store a content hash on install; compare with remote on `syncRemote()`, notify if outdated.  
       _Files:_ `src/skills/RemoteSync.ts`, `src/skills/InstallationDetector.ts`

- [ ] **Open SKILL.md in editor after install**  
       _Problem:_ After install the user has no quick way to inspect the installed file.  
       _Solution:_ Offer "Open file" action in the post-install notification.  
       _Files:_ `src/commands/installSkill.ts`

---

## Backlog (v1.3.0+)

- GitHub Actions workflow for automated semver bump + VSIX publish on merge to `main`.
- Support for **Windsurf** (`~/.windsurf/rules/`) as an install target.
- Custom skill authoring wizard — scaffold a new SKILL.md from a template via a guided QuickPick.
- Skills rating/voting system backed by a lightweight GitHub Discussions API.
- Search by risk level in Browse QuickPick.
- i18n / localization for UI strings.

---

## How to Implement — Step-by-Step Guide for Agents

### Adding a New Command

1. Create `src/commands/<verbNoun>.ts` exporting `register<VerbNoun>Command(manager: SkillsManager): vscode.Disposable`.
2. Add the command to `package.json` under `contributes.commands` (and `menus` if sidebar action needed).
3. Import and register in `extension.ts` inside `activate()`, push to `context.subscriptions`.
4. Add to `CHANGELOG.md` under `[Unreleased]`.

### Adding a New Installer

1. Create `src/installers/<AgentName>Installer.ts` implementing the `Installer` interface from `src/installers/types.ts`.
2. Extend `BaseInstaller` and override `targetPath()` to resolve the install destination.
3. Wire it into `installSkill.ts` and `installBulk.ts`.
4. Add configuration key(s) to `package.json` if a custom path override is needed.
5. Document in `README.md`.

### Updating the Skills Index

1. Add the SKILL.md folder under `assets/skills/<skill-id>/SKILL.md`.
2. Run `bun run scripts/prebuild.js` to regenerate `assets/skills_index.json`.
3. Verify with `bun run compile` that the bundle includes the new skill.
