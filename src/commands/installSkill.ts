import * as vscode from 'vscode';
import { SkillsManager } from '../skills/SkillsManager';
import { ProjectLocalInstaller } from '../installers/projectLocalInstaller';
import { InstallOptions, InstallResult } from '../installers/types';
import { ERR_SKILL_NOT_FOUND, ERR_CONTENT_MISSING } from '../constants';
import { RecentSkills } from '../recentSkills';
import { SkillUpdateTracker } from '../skills/SkillUpdateTracker';
import { maybePushToChat } from '../chat/openInChat';

export function registerInstallCommand(
  manager: SkillsManager,
  recentSkills: RecentSkills,
  tracker?: SkillUpdateTracker
): vscode.Disposable {
  return vscode.commands.registerCommand('aiSkills.install', async (skillId?: string) => {
    let resolvedId = skillId;

    if (!resolvedId) {
      const skills = manager.getAll();
      const picked = await vscode.window.showQuickPick(
        skills.map((s) => ({ label: s.id, description: s.description })),
        { placeHolder: 'Select skill to install…', matchOnDetail: true }
      );
      if (!picked) {
        return;
      }
      resolvedId = picked.label;
    }

    const skill = manager.findById(resolvedId);
    if (!skill) {
      vscode.window.showErrorMessage(ERR_SKILL_NOT_FOUND(resolvedId));
      return;
    }

    const skillFiles = await manager.readSkillDirectory(skill);
    const content = skillFiles.get('SKILL.md') ?? (await manager.readContent(skill));
    if (!content) {
      vscode.window.showErrorMessage(ERR_CONTENT_MISSING(resolvedId));
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const opts: InstallOptions = {
      skillId: resolvedId,
      skillContent: content,
      skillFiles: skillFiles.size > 1 ? skillFiles : undefined,
      workspaceRoot,
      tracker,
    };

    let result: InstallResult | undefined;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Installing '${resolvedId}'…`,
        cancellable: false,
      },
      async () => {
        result = await new ProjectLocalInstaller().install(opts);
      }
    );

    if (!result) {
      return;
    }

    if (result.success) {
      recentSkills.add(resolvedId);
      const action = await vscode.window.showInformationMessage(result.message, 'Open File');
      if (action === 'Open File' && result.destPath) {
        try {
          await vscode.window.showTextDocument(vscode.Uri.file(result.destPath));
        } catch {
          // File may not be readable in all editors
        }
      }
      // Auto-inject skill context into chat, honouring the openChatOnInstall setting.
      await maybePushToChat([resolvedId]);
    } else {
      vscode.window.showErrorMessage(`AI Skills: ${result.message}`);
    }
  });
}

/** Argument shapes that VSCode may pass from tree context menus */
type TreeItemArg = { skill: { id: string } } | string | undefined;

/** Also register the tree-context install command (same handler, different command id). */
export function registerInstallFromTreeCommand(_manager: SkillsManager): vscode.Disposable {
  return vscode.commands.registerCommand('aiSkills.installFromTree', async (item?: TreeItemArg) => {
    // item is a SkillItem from the tree context
    let skillId: string | undefined;
    if (item && typeof item === 'object' && 'skill' in item) {
      skillId = item.skill.id;
    } else if (typeof item === 'string') {
      skillId = item;
    }
    await vscode.commands.executeCommand('aiSkills.install', skillId);
  });
}
