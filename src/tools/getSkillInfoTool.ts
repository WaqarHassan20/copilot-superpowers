import * as vscode from 'vscode';
import { SkillsManager } from '../skills/SkillsManager';
import { isValidSkillId } from '../security';

interface GetSkillInfoInput {
  /** The skill ID to retrieve information for */
  skillId: string;
  /** Include full content preview. Default: false */
  includePreview?: boolean;
  /** Response format. Default: markdown */
  outputFormat?: 'markdown' | 'json';
}

interface SkillInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  risk: string;
  source: string;
  installed: boolean;
  installedPath?: string;
  preview?: string;
}

interface SkillInfoJsonResponse {
  skill: Omit<SkillInfo, 'preview'>;
  preview?: {
    truncated: boolean;
    text: string;
  };
}

/**
 * Language Model Tool that retrieves metadata and optional preview for a specific skill.
 * Unlike aiSkills_requestSkill, this does NOT install the skill - it only returns information.
 */
export class GetSkillInfoTool implements vscode.LanguageModelTool<GetSkillInfoInput> {
  constructor(private readonly manager: SkillsManager) {}

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<GetSkillInfoInput>,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    const { skillId } = options.input;
    return {
      invocationMessage: `Getting info for skill "${skillId}"…`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<GetSkillInfoInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { skillId, includePreview = false, outputFormat = 'markdown' } = options.input;

    // Validate skill ID format
    if (!isValidSkillId(skillId)) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error: "${skillId}" is not a valid skill ID. Use a kebab-case identifier like "react-patterns".`
        ),
      ]);
    }

    // Find the skill in the catalog
    const skill = this.manager.findById(skillId);
    if (!skill) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Skill "${skillId}" not found in the catalog. Use aiSkills_searchSkills to find available skills.`
        ),
      ]);
    }

    const installed = this.manager.isInstalled(skillId);
    const installedPath = installed ? this.manager.contentPath(skill) : undefined;

    let preview: string | undefined;
    if (includePreview && installed) {
      preview = (await this.manager.readContent(skill)) ?? undefined;
    }

    const skillInfo: SkillInfo = {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      description: skill.description,
      risk: skill.risk,
      source: skill.source,
      installed,
      installedPath,
      preview,
    };

    const textResponse =
      outputFormat === 'json'
        ? JSON.stringify(buildSkillInfoJsonResponse(skillInfo))
        : buildSkillInfoResponse(skillInfo);

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(textResponse)]);
  }
}

function buildSkillInfoJsonResponse(info: SkillInfo): SkillInfoJsonResponse {
  const previewLimit = 2000;
  const previewText = info.preview
    ? info.preview.length > previewLimit
      ? info.preview.substring(0, previewLimit)
      : info.preview
    : undefined;

  return {
    skill: {
      id: info.id,
      name: info.name,
      category: info.category,
      description: info.description,
      risk: info.risk,
      source: info.source,
      installed: info.installed,
      installedPath: info.installedPath,
    },
    preview: previewText
      ? {
          truncated: info.preview !== undefined && info.preview.length > previewLimit,
          text: previewText,
        }
      : undefined,
  };
}

function buildSkillInfoResponse(info: SkillInfo): string {
  let response = `## Skill: ${info.name} (${info.id})\n\n`;

  response += `| Property | Value |\n|----------|-------|\n`;
  response += `| **Category** | ${info.category} |\n`;
  response += `| **Risk Level** | ${info.risk} |\n`;
  response += `| **Source** | ${info.source} |\n`;
  response += `| **Installed** | ${info.installed ? '✅ Yes' : '❌ No'} |\n`;

  if (info.installedPath) {
    response += `| **Path** | ${info.installedPath} |\n`;
  }

  response += `\n**Description:** ${info.description}\n`;

  if (info.preview) {
    response += '\n---\n### Preview (first 2000 chars):\n\n';
    const previewText =
      info.preview.length > 2000 ? info.preview.substring(0, 2000) + '...' : info.preview;
    response += previewText;
    response += '\n\n---\n*Full content available via aiSkills_requestSkill*\n';
  } else if (!info.installed) {
    response +=
      '\n---\n**To install this skill**, use: `aiSkills_requestSkill` or `aiSkills_batchInstall`';
  }

  return response;
}

export function registerGetSkillInfoTool(manager: SkillsManager): vscode.Disposable {
  return vscode.lm.registerTool('aiSkills_getSkillInfo', new GetSkillInfoTool(manager));
}
