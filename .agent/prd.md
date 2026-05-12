# Product Requirements Document (PRD)

**Product:** AI Agent Superpowers  
**Type:** VS Code Extension  
**Publisher:** aliabbaschadhar  
**Current Version:** 1.2.0 (in progress)  
**Document Status:** Living document — updated each release

---

## 1. Problem Statement

AI coding assistants (GitHub Copilot, Cursor, Windsurf, AntiGravity) are highly capable but require well-crafted instruction files to unlock domain-specific expertise. Writing, organizing, and distributing these instruction files (“skills”) is a manual, fragmented, and undiscoverable process today.

Developers either:

- Don't know what skills exist.
- Spend time writing boilerplate instructions that already exist elsewhere.
- Struggle to keep skills up to date across multiple agents.

---

## 2. Goal

Provide a zero-friction in-editor experience to **browse, preview, and install** a curated library of 940+ AI agent skills, while supporting every major AI coding assistant workflow.

---

## 3. Target Users

| Persona                      | Description                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **AI-native developer**      | Uses GitHub Copilot, Cursor, or Windsurf daily; wants deep skill specialization without manual config      |
| **Team lead**                | Wants to standardize AI instructions across a team’s repo via `.agent/skills/` committed to source control |
| **AI hobbyist / power user** | Explores and collects skills, customizes their agent setup                                                 |
| **Agency/contractor**        | Uses multiple agents on multiple projects; needs fast skill switching                                      |

---

## 4. Non-Goals

- We do **not** host or execute skill content ourselves — skills are instruction files installed locally.
- We do **not** provide an AI assistant chat UI within the extension.
- We do **not** support CLI-based tools (Claude Code, Gemini CLI) — skills install project-locally for editor-based agents only.
- We do **not** monetize skill content — all skills in the bundle are free and open.

---

## 5. Core Features (v1.x)

### 5.1 Sidebar Skills Browser (P0)

- Activity Bar panel showing all 940+ skills organized by category.
- Category nodes are collapsible.
- Each skill node shows name, category, and risk badge.
- Special sections: **Favorites**, **Recent**, **Recommended** (workspace-aware).
- Filter toggle: "Show Installed Only".
- Inline actions per skill: Preview, Copy ID, Install, Uninstall.

### 5.2 Browse & Paste (P0)

- `Ctrl+Shift+/` opens a searchable QuickPick over all skills.
- Each item shows skill name, description, and risk badge.
- Selecting a skill installs it project-locally and copies `#file:.agent/skills/<id>/SKILL.md` refs to clipboard.
- User pastes into editor's AI chat (Copilot, Cursor, Windsurf, etc.) with `Ctrl+V`.

### 5.3 Skill Preview (P0)

- Opens `SKILL.md` content in a read-only side panel before installing.
- Works offline (bundled content).
- Future: Markdown rendering with syntax highlighting.

### 5.4 Install to Agent (P0)

- All skills install project-locally to `{workspaceRoot}/.agent/skills/{id}/SKILL.md`.
- Works with any editor-based AI agent that reads workspace files (GitHub Copilot, Cursor, Windsurf, AntiGravity).
- Overwrite confirmation (configurable).
- Post-install notification with undo hint.

### 5.5 Remote Sync (P1)

- Background fetch of latest skills index from GitHub.
- Merges new skills without overwriting existing ones.
- Non-blocking — extension is fully operational from bundled index before sync completes.

### 5.6 Workspace Recommendations (P1)

- Scans `package.json` and file extensions to detect tech stack.
- Surfaces relevant skills (e.g., detects React → recommends `react-patterns`).
- Shown as "Recommended" section at the top of the skills tree.

### 5.7 Local Skills (P1)

- `aiSkills.localSkillsPath` config allows users to point to their own skill folder.
- Any subfolder containing a `SKILL.md` is auto-discovered and shown in the tree.

### 5.8 Bulk Operations (P2)

- **Bulk Copy:** Select multiple skills in tree → copy all IDs to clipboard.
- **Install Category:** Install all skills in a category with one click.
- **Install All:** Install every skill (useful for power users bootstrapping full agent setups).

---

## 6. Technical Requirements

| Requirement           | Specification                                                             |
| --------------------- | ------------------------------------------------------------------------- |
| VS Code compatibility | ^1.90.0                                                                   |
| Offline-first         | All 940+ skills bundled in `.vsix`; no network required for core features |
| Bundle size           | `.vsix` ≤ 10 MB (skills are plain text, highly compressible)              |
| Startup time          | Extension activation ≤ 200 ms on average hardware                         |
| Runtime dependencies  | ≤ 1 (Fuse.js only)                                                        |
| Security              | No telemetry, no skill content sent to external servers                   |
| Platform              | Windows, macOS, Linux                                                     |

---

## 7. Success Metrics

| Metric                             | Target (v1.x)                |
| ---------------------------------- | ---------------------------- |
| VS Code Marketplace installs       | 5,000 in first 30 days       |
| Average rating                     | ≥ 4.5 / 5                    |
| Browse command usage rate          | ≥ 60% of weekly active users |
| Skills installed per user (median) | ≥ 3                          |
| Extension activation error rate    | < 0.5%                       |

---

## 8. Configuration Surface

All user-facing settings are under the `aiSkills.*` namespace in VS Code Settings:

| Setting            | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `confirmOverwrite` | Prompt before overwriting installed skill     |
| `showRiskBadge`    | Show/hide risk level in QuickPick             |
| `localSkillsPath`  | User's custom local skills directory          |
| `remoteIndexUrl`   | Override remote index URL (e.g., self-hosted) |

---

## 9. Risks & Mitigations

| Risk                                                | Likelihood | Impact | Mitigation                                                                            |
| --------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------- |
| `.vsix` grows too large as skill count increases    | Medium     | Medium | Only include `skills_index.json` in bundle; fetch SKILL.md content lazily from remote |
| Remote sync URL unavailable                         | Medium     | Low    | Graceful degradation to bundled index; no user-visible error                          |
| Agent install paths change in future agent versions | Low        | High   | Make all install paths configurable via settings                                      |
| Skill content quality degrades                      | Medium     | Medium | Add community rating system + editorial review process in backlog                     |
| VS Code API breaking change                         | Low        | High   | Pin to `^1.85.0`; monitor VS Code release notes; no proposed APIs used                |

---

## 10. Release History

| Version | Date               | Key Changes                                                                                                                 |
| ------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2026-03-05         | Initial release: sidebar, browse, install, preview, 946 skills bundled                                                      |
| 1.1.0   | 2026-03-06         | Gemini CLI support (later removed), 940+ skills                                                                             |
| 1.1.x   | 2026-03-08         | Project-local install refactor: all skills go to `.agent/skills/`; Claude/Gemini/Cursor/Copilot specific installers removed |
| 1.1.x   | 2026-03-09         | Sidebar overhaul: Favorites, Collections, update detection, RemoteSync retry, auto-install prompt                           |
| 1.1.x   | 2026-03-10         | Security audit: 5 path-traversal + URL vulnerabilities patched; `src/security.ts` added                                     |
| 1.1.x   | 2026-03-10         | Copilot LM Tool `aiSkills_requestSkill` implemented; `engines.vscode` bumped to ^1.90.0                                     |
| 1.1.x   | 2026-03-10         | README rewritten (editor-only focus); 7 bloat docs removed                                                                  |
| 1.1.x   | 2026-03-11         | README/package.json: removed stale CLI config, fixed Windsurf typo                                                          |
| 1.2.0   | Planned 2026-03-20 | InstallationDetector memoization, Markdown preview, monorepo scan                                                           |
