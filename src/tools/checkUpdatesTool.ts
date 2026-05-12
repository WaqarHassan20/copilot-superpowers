import * as vscode from 'vscode';
import { SkillsManager } from '../skills/SkillsManager';
import { SkillUpdateTracker } from '../skills/SkillUpdateTracker';

interface CheckUpdatesInput {
  /** Optional specific skill ID to check. If omitted, checks all installed skills. */
  skillId?: string;
  /** Response format. Default: markdown */
  outputFormat?: 'markdown' | 'json';
}

interface UpdateInfo {
  id: string;
  name: string;
  category: string;
  hasUpdate: boolean;
  installedHash?: string;
}

interface CheckUpdatesJsonResponse {
  skills: Array<{
    id: string;
    name: string;
    category: string;
    hasUpdate: boolean;
    installedHashPrefix?: string;
  }>;
  summary: {
    total: number;
    updatesAvailable: number;
    upToDate: number;
  };
}

/**
 * Language Model Tool that checks for available updates to installed skills.
 * Compares installed skill content hashes against the latest bundled versions.
 */
export class CheckUpdatesTool implements vscode.LanguageModelTool<CheckUpdatesInput> {
  constructor(
    private readonly manager: SkillsManager,
    private readonly tracker: SkillUpdateTracker
  ) {}

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<CheckUpdatesInput>,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    const { skillId } = options.input;
    const msg = skillId
      ? `Checking for updates to skill "${skillId}"…`
      : 'Checking for skill updates…';
    return {
      invocationMessage: msg,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<CheckUpdatesInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { skillId, outputFormat = 'markdown' } = options.input;

    const installedIds = this.manager.getInstalledIds();

    if (skillId) {
      // Check specific skill
      if (!installedIds.has(skillId)) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Skill "${skillId}" is not installed. Use aiSkills_requestSkill to install it first.`
          ),
        ]);
      }

      const skill = this.manager.findById(skillId);
      if (!skill) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Skill "${skillId}" not found in the catalog.`),
        ]);
      }

      const content = await this.manager.readContent(skill);
      if (!content) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Could not read content for skill "${skillId}".`),
        ]);
      }

      const hasUpdate = this.tracker.hasUpdate(skillId, content);
      const updateInfo: UpdateInfo = {
        id: skill.id,
        name: skill.name,
        category: skill.category,
        hasUpdate,
        installedHash: this.tracker.getHash(skillId),
      };

      const response =
        outputFormat === 'json'
          ? JSON.stringify(buildUpdatesJsonResponse([updateInfo]))
          : buildSingleSkillUpdateResponse(updateInfo, content);
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(response)]);
    }

    // Check all installed skills
    const allSkills = this.manager.getAll();
    const updates: UpdateInfo[] = [];

    for (const skill of allSkills) {
      if (!installedIds.has(skill.id)) {
        continue;
      }

      const content = await this.manager.readContent(skill);
      if (!content) {
        continue;
      }

      const hasUpdate = this.tracker.hasUpdate(skill.id, content);
      updates.push({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        hasUpdate,
        installedHash: this.tracker.getHash(skill.id),
      });
    }

    const response =
      outputFormat === 'json'
        ? JSON.stringify(buildUpdatesJsonResponse(updates))
        : buildAllUpdatesResponse(updates);
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(response)]);
  }
}

function buildUpdatesJsonResponse(updates: UpdateInfo[]): CheckUpdatesJsonResponse {
  const skills = updates.map((u) => ({
    id: u.id,
    name: u.name,
    category: u.category,
    hasUpdate: u.hasUpdate,
    installedHashPrefix: u.installedHash ? `${u.installedHash.substring(0, 16)}...` : undefined,
  }));

  const updatesAvailable = updates.filter((u) => u.hasUpdate).length;
  return {
    skills,
    summary: {
      total: updates.length,
      updatesAvailable,
      upToDate: updates.length - updatesAvailable,
    },
  };
}

function buildSingleSkillUpdateResponse(info: UpdateInfo, content: string): string {
  const status = info.hasUpdate ? '⚠️ Update available' : '✅ Up to date';

  let response = `## Skill Update Status: ${info.name} (${info.id})\n\n`;
  response += `**Status:** ${status}\n`;
  response += `**Category:** ${info.category}\n`;

  if (info.hasUpdate && content) {
    const oldHash = info.installedHash ?? 'unknown';
    const newHash = cryptoHash(content);
    response += `**Installed Hash:** ${oldHash.substring(0, 16)}...\n`;
    response += `**Latest Hash:** ${newHash.substring(0, 16)}...\n`;
    response +=
      '\n---\n**To update this skill**, use the `aiSkills.updateAll` command or reinstall via `aiSkills_requestSkill`.\n';
  } else {
    response += '\nThis skill is up to date. No action needed.\n';
  }

  return response;
}

function buildAllUpdatesResponse(updates: UpdateInfo[]): string {
  const total = updates.length;
  const outdated = updates.filter((u) => u.hasUpdate);
  const upToDate = updates.filter((u) => !u.hasUpdate);

  let response = `## Skill Update Summary\n\n`;
  response += `**Total Installed Skills:** ${total}\n`;
  response += `**Up to Date:** ${upToDate.length}\n`;
  response += `**Updates Available:** ${outdated.length}\n\n`;

  if (outdated.length === 0) {
    response += '✅ All installed skills are up to date!\n\n';
  } else {
    response += '### Skills with Updates Available:\n\n';
    for (const skill of outdated) {
      response += `⚠️ **${skill.id}** (${skill.name}) - Category: ${skill.category}\n`;
    }
    response += '\n---\n';
    response += '**To update all skills**, run the command: `aiSkills.updateAll`\n';
    response += '**To update a specific skill**, reinstall it via `aiSkills_requestSkill`.\n';
  }

  if (upToDate.length > 0) {
    response += '\n### Up-to-Date Skills:\n\n';
    for (const skill of upToDate) {
      response += `✅ ${skill.id}\n`;
    }
  }

  return response;
}

function cryptoHash(content: string): string {
  const cryptoModule = require('crypto');
  return cryptoModule.createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function registerCheckUpdatesTool(
  manager: SkillsManager,
  tracker: SkillUpdateTracker
): vscode.Disposable {
  return vscode.lm.registerTool('aiSkills_checkUpdates', new CheckUpdatesTool(manager, tracker));
}
