import { AgentActivityTracker, yieldToUi } from './AgentActivityTracker';
import { SkillsManager } from '../skills/SkillsManager';
import { SkillEntry } from '../skills/types';

/**
 * Resolves skill files and runs install while emitting two sidebar steps:
 * Loading skill → Installed (done).
 */
export interface SkillInstallOutcome {
  success: boolean;
  message?: string;
}

export async function trackSkillResolveAndInstall(
  tracker: AgentActivityTracker,
  skillId: string,
  manager: SkillsManager,
  skill: SkillEntry,
  install: (
    skillFiles: Map<string, string>,
    content: string
  ) => Promise<SkillInstallOutcome | undefined>
): Promise<SkillInstallOutcome | undefined> {
  tracker.beginSkillOperation(skillId);
  try {
    await yieldToUi();

    const skillFiles = await manager.readSkillDirectory(skill);
    if (skillFiles.size === 0) {
      const content = await manager.readContent(skill);
      if (!content) {
        tracker.fail('Content missing');
        return undefined;
      }
      tracker.finishLoading(1);
      await yieldToUi();
      tracker.startInstalling();
      await yieldToUi();
      const singleResult = await install(new Map([['SKILL.md', content]]), content);
      if (singleResult === undefined) {
        return undefined;
      }
      if (singleResult.success) {
        tracker.completeDone();
      } else {
        tracker.fail(singleResult.message ?? 'Failed');
      }
      return singleResult;
    }

    const content = skillFiles.get('SKILL.md') ?? (await manager.readContent(skill));
    if (!content) {
      tracker.fail('Content missing');
      return undefined;
    }

    tracker.finishLoading(skillFiles.size);
    await yieldToUi();
    tracker.startInstalling();
    await yieldToUi();

    const result = await install(skillFiles, content);
    if (result === undefined) {
      return undefined;
    }
    if (result.success) {
      tracker.completeDone();
    } else {
      tracker.fail(result.message ?? 'Failed');
    }
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    tracker.fail(msg);
    throw err;
  }
}

/**
 * Load-only (chat / already installed): Loading skill → Done.
 */
export async function trackSkillResolveAndLoad(
  tracker: AgentActivityTracker,
  skillId: string,
  manager: SkillsManager,
  skill: SkillEntry
): Promise<Map<string, string>> {
  tracker.beginSkillOperation(skillId);
  try {
    await yieldToUi();

    const skillFiles = await manager.readSkillDirectory(skill);
    if (skillFiles.size === 0) {
      tracker.fail('Content missing');
      return new Map();
    }

    tracker.finishLoading(skillFiles.size);
    await yieldToUi();
    tracker.completeLoadOnly();
    return skillFiles;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    tracker.fail(msg);
    throw err;
  }
}
