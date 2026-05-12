import * as vscode from 'vscode';
import Fuse from 'fuse.js';
import { SkillsManager } from '../skills/SkillsManager';
import { SkillUpdateTracker } from '../skills/SkillUpdateTracker';
import { WorkspaceScanner } from '../skills/WorkspaceScanner';
import { SkillEntry } from '../skills/types';
import { installSkill, BatchInstallResult } from './batchInstallTool';

interface PlanInstallInput {
  query: string;
  limit?: number;
  includeInstalled?: boolean;
  install?: boolean;
  overwrite?: boolean;
  outputFormat?: 'markdown' | 'json';
}

interface Recommendation {
  id: string;
  name: string;
  category: string;
  description: string;
  score: number;
  reason: string;
  installed: boolean;
}

interface PlanInstallJsonResponse {
  query: string;
  recommendations: Recommendation[];
  installRequested: boolean;
  installResults?: {
    summary: {
      total: number;
      installed: number;
      skipped: number;
      failed: number;
    };
    results: BatchInstallResult[];
  };
}

export class PlanInstallTool implements vscode.LanguageModelTool<PlanInstallInput> {
  private readonly scanner = new WorkspaceScanner();

  constructor(
    private readonly manager: SkillsManager,
    private readonly tracker: SkillUpdateTracker
  ) {}

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<PlanInstallInput>,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    const { query, install = false, limit = 8 } = options.input;

    if (!install) {
      return {
        invocationMessage: `Planning skill install for "${query}"...`,
      };
    }

    return {
      confirmationMessages: {
        title: 'Plan & Install Skills',
        message: new vscode.MarkdownString(
          `Install up to ${limit} recommended skill(s) for **${query}**?\n\nThis will write files to \`.agent/skills/\`.`
        ),
      },
      invocationMessage: 'Installing planned skill(s)...',
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<PlanInstallInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const {
      query,
      limit = 8,
      includeInstalled = true,
      install = false,
      overwrite = false,
      outputFormat = 'markdown',
    } = options.input;

    if (!query || query.trim().length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: "query" is required for aiSkills_planInstall.'),
      ]);
    }

    const recommendations = await this.computeRecommendations(query, limit, includeInstalled);
    const response: PlanInstallJsonResponse = {
      query,
      recommendations,
      installRequested: install,
    };

    if (install) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            'Error: No workspace folder open. Please open a workspace folder before installing skills.'
          ),
        ]);
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const selectedSkills = recommendations
        .map((r) => this.manager.findById(r.id))
        .filter((s): s is SkillEntry => Boolean(s));

      const results: BatchInstallResult[] = [];
      let installed = 0;
      let skipped = 0;
      let failed = 0;

      for (const skill of selectedSkills) {
        if (token.isCancellationRequested) {
          break;
        }
        const result = await installSkill(
          skill,
          workspaceRoot,
          overwrite,
          this.manager,
          this.tracker
        );
        results.push(result);
        if (result.success && !result.message.includes('Skipped')) {
          installed++;
        } else if (
          result.message.includes('Skipped') ||
          result.message.includes('already installed')
        ) {
          skipped++;
        } else if (!result.success) {
          failed++;
        }
      }

      response.installResults = {
        summary: {
          total: results.length,
          installed,
          skipped,
          failed,
        },
        results,
      };
    }

    const text =
      outputFormat === 'json'
        ? JSON.stringify(response)
        : buildPlanInstallMarkdownResponse(response);
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
  }

  private async computeRecommendations(
    query: string,
    limit: number,
    includeInstalled: boolean
  ): Promise<Recommendation[]> {
    const installedIds = this.manager.getInstalledIds();
    const techs = await this.scanner.scan();
    const techRecommended = new Set(this.manager.getRecommended(techs, 50).map((s) => s.id));

    const fuse = new Fuse(this.manager.getAll(), {
      keys: [
        { name: 'id', weight: 0.55 },
        { name: 'description', weight: 0.35 },
        { name: 'category', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
      shouldSort: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });

    const items = fuse.search(query);
    const recommendations: Recommendation[] = [];

    for (const result of items) {
      const skill = result.item;
      const installed = installedIds.has(skill.id);
      if (!includeInstalled && installed) {
        continue;
      }
      if (recommendations.length >= limit) {
        break;
      }

      const rawScore = result.score ?? 1;
      const techBoost = techRecommended.has(skill.id) ? 0.08 : 0;
      const score = Math.max(0, Math.min(1, 1 - rawScore + techBoost));
      const reason = techRecommended.has(skill.id)
        ? 'Matches query and your detected workspace stack.'
        : 'Matches your natural-language query.';

      recommendations.push({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        description: skill.description,
        score,
        reason,
        installed,
      });
    }

    return recommendations;
  }
}

function buildPlanInstallMarkdownResponse(payload: PlanInstallJsonResponse): string {
  const recommendations = payload.recommendations;
  let response = `## Skill Plan for "${payload.query}"\n\n`;

  if (recommendations.length === 0) {
    response += 'No matching skills found. Try broader keywords.\n';
    return response;
  }

  response += `Suggested ${recommendations.length} skill(s):\n\n`;
  for (const rec of recommendations) {
    const status = rec.installed ? '✅ installed' : '⬜ not installed';
    response += `- **${rec.id}** (${rec.name}) — ${status}\n`;
    response += `  Category: ${rec.category} | Score: ${Math.round(rec.score * 100)}%\n`;
    response += `  Reason: ${rec.reason}\n`;
  }

  if (payload.installResults) {
    response += '\n---\n';
    response += `Install complete: total ${payload.installResults.summary.total}, `;
    response += `installed ${payload.installResults.summary.installed}, `;
    response += `skipped ${payload.installResults.summary.skipped}, `;
    response += `failed ${payload.installResults.summary.failed}.\n`;
  } else {
    response += '\n---\nUse `install: true` to install these recommendations in one step.\n';
  }

  return response;
}

export function registerPlanInstallTool(
  manager: SkillsManager,
  tracker: SkillUpdateTracker
): vscode.Disposable {
  return vscode.lm.registerTool('aiSkills_planInstall', new PlanInstallTool(manager, tracker));
}
