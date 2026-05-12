# Architecture

Software architecture of **AI Agent Superpowers** — a VS Code extension.

---

## High-Level Overview

```
┌───────────────────────────────────────────────────────────┐
│                      VS Code Host                         │
│                                                           │
│  ┌─────────────┐   ┌──────────────────┐  ┌────────────┐  │
│  │  Activity   │   │  Command Palette  │  │  Webview   │  │
│  │  Bar Tree   │   │  (QuickPick)      │  │  Preview   │  │
│  └──────┬──────┘   └────────┬─────────┘  └─────┬──────┘  │
│         │                   │                   │         │
│  ┌──────▼───────────────────▼───────────────────▼──────┐  │
│  │                  extension.ts (activate)             │  │
│  │     - wires commands, tree, scanner, sync            │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                             │                              │
│             ┌───────────────┼───────────────┐             │
│             ▼               ▼               ▼             │
│      SkillsManager   SkillsTreeProvider  Installers       │
│             │               │               │             │
│      ┌──────┴──────┐        │     ┌─────────┴────────┐   │
│      │SkillsRepo      │        │     │ProjectLocal       │   │
│      │RemoteSync      │        │     │Installer          │   │
│      │FuzzySearch     │        │     └───────────────────┘   │
│      │WorkspaceScan   │        │                             │
│      └─────────────┘        │                             │
│                             ▼                             │
│                       nodes.ts (tree items)               │
└───────────────────────────────────────────────────────────┘
```

---

## Layers

### 1. Entry Point — `src/extension.ts`

- `activate(context)` is the single VS Code entry point.
- Instantiates `SkillsManager`, `SkillsTreeProvider`, `WorkspaceScanner`, `RecentSkills`, `FavoriteSkills`.
- Registers all commands and pushes them onto `context.subscriptions`.
- Kicks off background `syncRemote()` and workspace technology scan.

### 2. Skills Data Layer — `src/skills/`

| File                      | Role                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `SkillsManager.ts`        | Facade: init, query (`getAll`, `search`, `getById`, `getRecommended`), sync, local sources                     |
| `SkillsRepository.ts`     | Reads `assets/skills_index.json` (bundled) + optional user-local skill folders                                 |
| `RemoteSync.ts`           | Fetches latest index JSON from GitHub raw/Gist; caches in extension storage. Retries 3× with 1s/2s/4s back-off |
| `FuzzySearch.ts`          | Fuse.js wrapper; index built once on first query, then reused                                                  |
| `InstallationDetector.ts` | Checks `.agent/skills/{id}/SKILL.md` to mark skills as installed                                               |
| `WorkspaceScanner.ts`     | Reads workspace package.json/files to detect tech stack                                                        |
| `SkillUpdateTracker.ts`   | SHA-256 hashes installed skill content; detects when remote version is newer                                   |
| `UserCollections.ts`      | `GlobalState`-backed CRUD for custom user-defined skill collections                                            |
| `collections.ts`          | Built-in curated skill collection definitions                                                                  |
| `techSkillMap.ts`         | Static mapping of technology names → recommended skill IDs                                                     |
| `types.ts`                | `SkillEntry` interface                                                                                         |

**Data flow — startup:**

```
assets/skills_index.json
        │
        ▼
SkillsRepository.load()
        │
        ├── merge remote cache (storagePath/skills_index.json)
        │
        ├── merge local sources (aiSkills.localSkillsPath)
        │
        └── ▶ SkillsManager.skills[]
```

**Data flow — remote sync (background):**

```
GitHub raw URL
      │  (fetch)
      ▼
RemoteSync.fetchIndex()
      │  (save cache)
      ▼
storagePath/skills_index.json
      │  (merge)
      ▼
SkillsManager.skills[]  →  SkillsTreeProvider.refresh()
```

### 3. Presentation Layer — `src/tree/`

| File                    | Role                                                |
| ----------------------- | --------------------------------------------------- |
| `SkillsTreeProvider.ts` | Implements `vscode.TreeDataProvider<SkillTreeNode>` |
| `nodes.ts`              | Defines `SummaryNode`, `CategoryNode`, `SkillNode`  |

Tree structure:

```
📋 Summary (N skills, M installed)
├── ⭐ Favorites
├── 🔁 Recent
├── 💡 Recommended  (if workspace techs detected)
├── � Collections  (built-in + custom)
├── 📚 All Categories
│   ├── 📁 Category A
│   │   ├── skill-id-1
│   │   └── skill-id-2
│   └── 📁 Category B
│       └── ...
└── 🔄 Updates Available  (when aiSkills.updatesAvailable context key is set)
```

### 4. Command Layer — `src/commands/`

Each file exports a `register*Command()` factory returning a `vscode.Disposable`.

| Command File              | VS Code Command ID                                                                | Trigger                          |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------- |
| `browseSkills.ts`         | `aiSkills.browse`                                                                 | `Ctrl+Shift+/`                   |
| `installSkill.ts`         | `aiSkills.install` / `aiSkills.installFromTree`                                   | Sidebar / Palette                |
| `previewSkill.ts`         | `aiSkills.preview`                                                                | Sidebar eye icon                 |
| `copySkillId.ts`          | `aiSkills.copyId`                                                                 | Inline tree button               |
| `uninstallSkill.ts`       | `aiSkills.uninstall` / `aiSkills.uninstallCategory` / `aiSkills.uninstallAll`     | Inline / Category / All          |
| `bulkCopySkills.ts`       | `aiSkills.bulkCopy`                                                               | Toolbar                          |
| `installBulk.ts`          | `aiSkills.installCategory` / `aiSkills.installAll` / `aiSkills.installCollection` | Toolbar / Category / Collection  |
| `toggleFavorite.ts`       | `aiSkills.toggleFavorite`                                                         | Inline star button               |
| `clearFavorites.ts`       | `aiSkills.clearFavorites`                                                         | Favorites section header         |
| `browseCollections.ts`    | `aiSkills.browseCollections`                                                      | Toolbar                          |
| `createCollection.ts`     | `aiSkills.createCollection`                                                       | Toolbar                          |
| `addToCollection.ts`      | `aiSkills.addToCollection` / `aiSkills.removeFromCollection`                      | Context menu                     |
| `deleteCollection.ts`     | `aiSkills.deleteCollection` / `aiSkills.editCollection`                           | Collection node                  |
| `createSkill.ts`          | `aiSkills.createSkill`                                                            | Toolbar                          |
| `exportImportSkillSet.ts` | `aiSkills.exportSkillSet` / `aiSkills.importSkillSet`                             | Toolbar                          |
| `updateAllSkills.ts`      | `aiSkills.updateAll`                                                              | Toolbar (when updates available) |
| `refreshCatalog.ts`       | `aiSkills.refreshCatalog`                                                         | Palette                          |

### 5. Installer Layer — `src/installers/`

All installers implement the common interface defined in `types.ts`.

| Installer               | Target Path                                   |
| ----------------------- | --------------------------------------------- |
| `ProjectLocalInstaller` | `{workspaceRoot}/.agent/skills/{id}/SKILL.md` |

`BaseInstaller` (`baseInstaller.ts`) provides shared file-write logic, path validation via `src/security.ts`, and overwrite confirmation. `ProjectLocalInstaller` extends it and resolves paths relative to the active VS Code workspace root.

### 6. LM Tool Layer — `src/tools/`

| File                  | Role                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requestSkillTool.ts` | `RequestSkillTool` — implements `vscode.LanguageModelTool`. Installs and returns skill content on-demand during Copilot responses. Shows confirmation dialog when skill is not yet installed |

### 7. Utilities

| File                | Role                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------- |
| `editorDetector.ts` | Determines if VS Code or Cursor is the running host                                   |
| `logger.ts`         | Wraps `vscode.window.createOutputChannel` with `log()` helper                         |
| `constants.ts`      | All magic strings: command IDs, config keys, error messages                           |
| `security.ts`       | Path validation: `isValidSkillId`, `isPathWithin`, `isHttpsUrl`, `isSafeRelativePath` |
| `favoriteSkills.ts` | `GlobalState`-backed Set of favorited skill IDs                                       |
| `recentSkills.ts`   | `GlobalState`-backed LRU list of recently used skill IDs                              |

---

## Asset Pipeline

```
scripts/prebuild.js
  ├── Reads assets/skills/  (940+ SKILL.md folders)
  ├── Generates assets/skills_index.json
  └── Generates assets/manifest.json

esbuild.config.js
  ├── Bundles src/ → dist/extension.js
  └── Copies assets/ → dist/assets/  (included in .vsix)
```

---

## Configuration Schema (`package.json` contributes.configuration)

| Key                         | Type    | Default | Purpose                    |
| --------------------------- | ------- | ------- | -------------------------- |
| `aiSkills.confirmOverwrite` | boolean | `true`  | Ask before overwrite       |
| `aiSkills.showRiskBadge`    | boolean | `true`  | Risk badge in QuickPick    |
| `aiSkills.localSkillsPath`  | string  | `""`    | Local custom skills folder |
| `aiSkills.remoteIndexUrl`   | string  | `""`    | Override remote index URL  |

---

## Dependency Graph (runtime)

```
extension.ts
  ├── SkillsManager  ←─ SkillsRepository, RemoteSync, FuzzySearch, SkillUpdateTracker
  ├── SkillsTreeProvider  ←─ nodes.ts, FavoriteSkills, UserCollections
  ├── WorkspaceScanner  ←─ techSkillMap
  ├── RecentSkills
  ├── FavoriteSkills
  ├── UserCollections
  ├── RequestSkillTool  (LM tool)
  └── commands/*  ←─ ProjectLocalInstaller, SkillsManager
```

Runtime dependency: **Fuse.js** (fuzzy search). No other external runtime deps.
