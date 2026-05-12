import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const GITIGNORE_COMMENT =
  '# Copilot Superpowers — installed skills (local only, not tracked by git)';
const GITIGNORE_ENTRIES = ['.agent/skills/', '.agent/skills-catalog.md'];
const STATE_KEY = 'copilotSuperpowers.gitignorePatched';

/**
 * Appends `.agent/skills/` and `.agent/skills-catalog.md` to the workspace
 * `.gitignore` the first time a skill is installed. Subsequent calls are
 * no-ops (tracked via `workspaceState`). Also skips gracefully when all
 * entries are already present in the file.
 */
export async function patchGitignoreOnFirstInstall(
  context: vscode.ExtensionContext
): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    return;
  }

  // Already patched this workspace — skip
  if (context.workspaceState.get<boolean>(STATE_KEY)) {
    return;
  }

  const gitignorePath = path.join(workspaceRoot, '.gitignore');

  // Read existing content (or start fresh if file doesn't exist)
  let existing = '';
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, 'utf-8');
  }

  // Determine which entries are missing
  const existingLines = existing.split('\n').map((l) => l.trim());
  const missingEntries = GITIGNORE_ENTRIES.filter((entry) => !existingLines.includes(entry));

  if (missingEntries.length === 0) {
    // All patterns already present — mark done and exit
    await context.workspaceState.update(STATE_KEY, true);
    return;
  }

  // Build the block to append, ensuring a clean newline before the comment
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  const block = `${prefix}\n${GITIGNORE_COMMENT}\n${missingEntries.join('\n')}\n`;

  try {
    fs.appendFileSync(gitignorePath, block, 'utf-8');
    await context.workspaceState.update(STATE_KEY, true);

    // One-time notification with an action to open the file
    const action = await vscode.window.showInformationMessage(
      `Copilot Superpowers: Added skill paths to your .gitignore to keep them local.`,
      'Open .gitignore'
    );
    if (action === 'Open .gitignore') {
      await vscode.window.showTextDocument(vscode.Uri.file(gitignorePath));
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.error('[CopilotSuperpowers] Failed to patch .gitignore:', err);
  }
}
