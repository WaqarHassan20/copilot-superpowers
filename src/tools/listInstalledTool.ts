import * as vscode from 'vscode';
import { SkillsManager } from '../skills/SkillsManager';

interface ListInstalledInput {
  /** Optional category filter. If provided, only returns skills in that category. */
  category?: string;
  /** Optional limit on number of results. Default: 100 */
  limit?: number;
  /** Response format. Default: markdown */
  outputFormat?: 'markdown' | 'json';
}

interface InstalledSkillInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  installedPath?: string;
}

interface ListInstalledJsonResponse {
  category?: string;
  count: number;
  skills: InstalledSkillInfo[];
}

/**
 * Language Model Tool that lists all installed AI skills.
 * Useful for Copilot to understand what skills are available in the current environment.
 */
export class ListInstalledTool implements vscode.LanguageModelTool<ListInstalledInput> {
  constructor(private readonly manager: SkillsManager) {}

  prepareInvocation(
    _options: vscode.LanguageModelToolInvocationPrepareOptions<ListInstalledInput>,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: 'Listing installed AI skills…',
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ListInstalledInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { category, limit = 100, outputFormat = 'markdown' } = options.input;

    const installedIds = this.manager.getInstalledIds();
    const allSkills = this.manager.getAll();

    const result: InstalledSkillInfo[] = [];

    for (const skill of allSkills) {
      if (!installedIds.has(skill.id)) {
        continue;
      }

      if (category && skill.category !== category) {
        continue;
      }

      if (result.length >= limit) {
        break;
      }

      result.push({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        description: skill.description,
        installedPath: this.manager.contentPath(skill),
      });
    }

    const textResponse =
      outputFormat === 'json'
        ? JSON.stringify(buildInstalledSkillsJsonResponse(result, category))
        : buildInstalledSkillsResponse(result, category);

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(textResponse)]);
  }
}

function buildInstalledSkillsJsonResponse(
  skills: InstalledSkillInfo[],
  categoryFilter?: string
): ListInstalledJsonResponse {
  return {
    category: categoryFilter,
    count: skills.length,
    skills,
  };
}

function buildInstalledSkillsResponse(
  skills: InstalledSkillInfo[],
  categoryFilter?: string
): string {
  if (skills.length === 0) {
    const msg = categoryFilter
      ? `No installed skills found in category "${categoryFilter}".`
      : 'No AI skills are currently installed.';
    return msg + '\n\nUse aiSkills_searchSkills to find skills to install.';
  }

  let response = `Found ${skills.length} installed AI skill${skills.length !== 1 ? 's' : ''}`;
  if (categoryFilter) {
    response += ` in category "${categoryFilter}"`;
  }
  response += ':\n\n';

  for (const skill of skills) {
    response += `- **${skill.id}** (${skill.name})\n`;
    response += `  Category: ${skill.category}\n`;
    response += `  Description: ${skill.description}\n`;
    if (skill.installedPath) {
      response += `  Path: ${skill.installedPath}\n`;
    }
    response += '\n';
  }

  return response;
}

export function registerListInstalledTool(manager: SkillsManager): vscode.Disposable {
  return vscode.lm.registerTool('aiSkills_listInstalled', new ListInstalledTool(manager));
}
