import * as vscode from 'vscode';

/**
 * Opens Copilot chat pre-filled with `@aiSkills <id>` for every skill in the list.
 * Multiple skills are sent as a single space-separated query so the participant
 * can load them sequentially in one chat turn.
 *
 * Falls back to copying `#file:` references to the clipboard when Copilot is
 * not available.
 *
 * @param skillIds  One or more skill IDs to activate.
 */
export async function openSkillsInChat(skillIds: string[]): Promise<void> {
  if (skillIds.length === 0) {
    return;
  }

  // Build the query: single skill → "@aiSkills react-patterns"
  //                  multiple   → "@aiSkills react-patterns typescript-pro"
  const query =
    skillIds.length === 1 ? `@aiSkills ${skillIds[0]}` : `@aiSkills ${skillIds.join(' ')}`;

  try {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query,
      isPartialQuery: false,
    });
    const label = skillIds.length === 1 ? `'${skillIds[0]}'` : `${skillIds.length} skills`;
    vscode.window.showInformationMessage(
      `$(check) ${label} activated — skill context loading in chat`
    );
    return;
  } catch {
    // Copilot not available — fall through to #file: fallback
  }

  // Fallback: build #file: references for every installed skill
  const refs = skillIds.map((id) => `#file:.agent/skills/${id}/SKILL.md`).join(' ');
  try {
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: refs,
      isPartialQuery: true,
    });
    vscode.window.showInformationMessage(
      `$(check) Skills installed — skill files added to chat context`
    );
  } catch {
    await vscode.env.clipboard.writeText(refs);
    vscode.window.showInformationMessage(
      `$(clippy) Skills installed — paste in chat to add as context (Ctrl+V)`
    );
  }
}

/**
 * Reads the user's `aiSkills.openChatOnInstall` preference.
 * Defaults to `"always"` if not set.
 */
export function getChatOnInstallPref(): 'always' | 'ask' | 'never' {
  return vscode.workspace
    .getConfiguration('aiSkills')
    .get<'always' | 'ask' | 'never'>('openChatOnInstall', 'always');
}

/**
 * Decides whether to open chat and does so, honouring the user preference.
 *
 * - `"always"` → opens immediately (or shows prompt for large batches ≥ 10).
 * - `"ask"`    → always shows a notification with an "Open in Chat" button.
 * - `"never"`  → no-op.
 *
 * @param installedIds  IDs that were *successfully* installed in this operation.
 */
export async function maybePushToChat(installedIds: string[]): Promise<void> {
  if (installedIds.length === 0) {
    return;
  }

  const pref = getChatOnInstallPref();
  if (pref === 'never') {
    return;
  }

  // For large bulk installs (≥ 10 skills), always ask regardless of pref to
  // avoid an overwhelming chat session.
  const isBigBatch = installedIds.length >= 10;

  if (pref === 'always' && !isBigBatch) {
    await openSkillsInChat(installedIds);
    return;
  }

  // "ask" mode, or a big batch in "always" mode
  const label =
    installedIds.length === 1 ? `'${installedIds[0]}'` : `${installedIds.length} skills`;
  const action = await vscode.window.showInformationMessage(
    `${label} installed. Add to chat context?`,
    'Open in Chat',
    'Later'
  );
  if (action === 'Open in Chat') {
    await openSkillsInChat(installedIds);
  }
}
