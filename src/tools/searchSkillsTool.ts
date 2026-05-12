import * as vscode from 'vscode';
import { SkillsManager } from '../skills/SkillsManager';
import Fuse from 'fuse.js';

interface SearchSkillsInput {
  /** Search query - can be skill name, description, or category */
  query: string;
  /** Optional category filter */
  category?: string;
  /** Optional limit on results. Default: 20 */
  limit?: number;
  /** Include installation status in results. Default: true */
  includeInstalled?: boolean;
  /** Response format. Default: markdown */
  outputFormat?: 'markdown' | 'json';
}

interface SearchSkillResult {
  id: string;
  name: string;
  category: string;
  description: string;
  risk: string;
  installed: boolean;
  score?: number;
}

interface FuseSearchResult {
  item: {
    id: string;
    name: string;
    category: string;
    description: string;
    risk: string;
  };
  score?: number;
}

interface SearchSkillsJsonResponse {
  query: string;
  category?: string;
  count: number;
  results: SearchSkillResult[];
}

/**
 * Language Model Tool that searches the skill catalog by keyword.
 * Uses fuzzy search to match queries against skill names and descriptions.
 */
export class SearchSkillsTool implements vscode.LanguageModelTool<SearchSkillsInput> {
  constructor(private readonly manager: SkillsManager) {}

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<SearchSkillsInput>,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    const { query } = options.input;
    return {
      invocationMessage: `Searching skills for "${query}"…`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<SearchSkillsInput>,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const {
      query,
      category,
      limit = 20,
      includeInstalled = true,
      outputFormat = 'markdown',
    } = options.input;

    if (!query || query.trim().length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Error: Search query is required. Provide a non-empty "query" parameter.'
        ),
      ]);
    }

    const installedIds = includeInstalled ? this.manager.getInstalledIds() : new Set<string>();

    // Use fuzzy search for better matching - get results with scores
    const fuse = new Fuse(this.manager.getAll(), {
      keys: [
        { name: 'id', weight: 0.5 },
        { name: 'description', weight: 0.4 },
        { name: 'category', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
      shouldSort: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
    });

    const fuseResults: FuseSearchResult[] = fuse.search(query);

    const results: SearchSkillResult[] = [];

    for (const fuseResult of fuseResults) {
      const skill = fuseResult.item;
      if (category && skill.category !== category) {
        continue;
      }

      if (results.length >= limit) {
        break;
      }

      results.push({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        description: skill.description,
        risk: skill.risk,
        installed: installedIds.has(skill.id),
        score: fuseResult.score,
      });
    }

    const textResponse =
      outputFormat === 'json'
        ? JSON.stringify(buildSearchJsonResponse(results, query, category))
        : buildSearchResponse(results, query, category);

    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(textResponse)]);
  }
}

function buildSearchJsonResponse(
  results: SearchSkillResult[],
  query: string,
  category?: string
): SearchSkillsJsonResponse {
  return {
    query,
    category,
    count: results.length,
    results,
  };
}

function buildSearchResponse(
  results: SearchSkillResult[],
  query: string,
  categoryFilter?: string
): string {
  if (results.length === 0) {
    let msg = `No skills found matching "${query}"`;
    if (categoryFilter) {
      msg += ` in category "${categoryFilter}"`;
    }
    msg +=
      '.\n\nTry:\n- Using different keywords\n- Searching by category (e.g., "react", "aws", "security")\n- Browsing all skills with aiSkills_browse command';
    return msg;
  }

  let response = `Found ${results.length} skill${results.length !== 1 ? 's' : ''} matching "${query}"`;
  if (categoryFilter) {
    response += ` in category "${categoryFilter}"`;
  }
  response += ':\n\n';

  for (const skill of results) {
    const status = skill.installed ? '✅' : '⬜';
    response += `${status} **${skill.id}** (${skill.name})\n`;
    response += `   Category: ${skill.category} | Risk: ${skill.risk}\n`;
    response += `   Description: ${skill.description}\n`;
    if (skill.score !== undefined) {
      response += `   Relevance: ${Math.round(skill.score * 100)}%\n`;
    }
    response += '\n';
  }

  response += '\n---\n**To install a skill**, use aiSkills_batchInstall with the skill ID(s).\n';
  response += '**To get full skill content**, use aiSkills_requestSkill with the skill ID.';

  return response;
}

export function registerSearchSkillsTool(manager: SkillsManager): vscode.Disposable {
  return vscode.lm.registerTool('aiSkills_searchSkills', new SearchSkillsTool(manager));
}
