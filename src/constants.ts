/** Remote Syncing */
export const REMOTE_INDEX_URL =
  'https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills_index.json';

// Trailing slash so `${REMOTE_BASE_URL}${skill.path}/SKILL.md` concatenates correctly.
// skill.path from the antigravity index is relative, e.g. "skills/bug-hunter"
export const REMOTE_BASE_URL =
  'https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/';

/** UI / display */
export const DESCRIPTION_TRUNCATE_LENGTH = 60;

/** Extension prefix used in all user-facing messages */
export const EXT_PREFIX = 'Copilot Superpowers';

/** Command identifiers */
export const CMD_BROWSE = 'aiSkills.browse';
export const CMD_INSTALL = 'aiSkills.install';
export const CMD_INSTALL_FROM_TREE = 'aiSkills.installFromTree';
export const CMD_PREVIEW = 'aiSkills.preview';
export const CMD_COPY_ID = 'aiSkills.copyId';
export const CMD_REFRESH_TREE = 'aiSkills.refreshTree';
export const CMD_FILTER_TREE = 'aiSkills.filterTree';
export const CMD_UNINSTALL = 'aiSkills.uninstall';
export const CMD_UNINSTALL_ALL = 'aiSkills.uninstallAll';
export const CMD_TOGGLE_FAVORITE = 'aiSkills.toggleFavorite';
export const CMD_CLEAR_FAVORITES = 'aiSkills.clearFavorites';
export const CMD_BROWSE_COLLECTIONS = 'aiSkills.browseCollections';
export const CMD_CREATE_SKILL = 'aiSkills.createSkill';
export const CMD_EXPORT_SKILL_SET = 'aiSkills.exportSkillSet';
export const CMD_IMPORT_SKILL_SET = 'aiSkills.importSkillSet';
export const CMD_CREATE_COLLECTION = 'aiSkills.createCollection';
export const CMD_EDIT_COLLECTION = 'aiSkills.editCollection';
export const CMD_DELETE_COLLECTION = 'aiSkills.deleteCollection';
export const CMD_ADD_TO_COLLECTION = 'aiSkills.addToCollection';
export const CMD_REMOVE_FROM_COLLECTION = 'aiSkills.removeFromCollection';
export const CMD_UPDATE_ALL = 'aiSkills.updateAll';
export const CMD_REFRESH_CATALOG = 'aiSkills.refreshCatalog';

/** Configuration keys */
export const CONF_SHOW_RISK_BADGE = 'aiSkills.showRiskBadge';

/** VS Code context keys */
export const CTX_INSTALLED_FILTER = 'aiSkills.installedFilterActive';
export const CTX_UPDATES_AVAILABLE = 'aiSkills.updatesAvailable';

/** User-facing error messages */
export const ERR_BUNDLE_INCOMPLETE =
  'AI Agent Skills: Asset bundle is incomplete or missing. Try reinstalling the extension.';

export const ERR_NO_SKILLS = `${EXT_PREFIX}: No skills loaded. The extension bundle may be corrupted.`;

export const ERR_SKILL_NOT_FOUND = (id: string): string =>
  `${EXT_PREFIX}: Skill '${id}' not found in index.`;

export const ERR_CONTENT_MISSING = (id: string): string =>
  `${EXT_PREFIX}: Content for skill '${id}' is missing from bundle.`;

export const ERR_OPEN_FILE = (id: string): string =>
  `${EXT_PREFIX}: Could not open SKILL.md for '${id}'.`;
