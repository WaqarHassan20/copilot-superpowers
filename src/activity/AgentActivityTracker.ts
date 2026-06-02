import * as vscode from 'vscode';

export type ActivityState = 'running' | 'success' | 'error';

export type ActivityPhase = 'idle' | 'loading' | 'installing' | 'done' | 'failed';

export interface ActivityEntry {
  id: string;
  skillId?: string;
  label: string;
  statusText: string;
  state: ActivityState;
  timestamp: number;
}

export interface ActivityStatusDetail {
  skillId: string;
  phase: ActivityPhase;
  detail: string;
  timestamp: number;
}

interface ActivityOperation {
  skillId: string;
  step1: ActivityEntry;
  step2?: ActivityEntry;
  status: ActivityStatusDetail;
}

const IDLE_STATUS: ActivityStatusDetail = {
  skillId: '—',
  phase: 'idle',
  detail: 'Waiting',
  timestamp: Date.now(),
};

let nextId = 0;

function createId(): string {
  return `activity-${++nextId}-${Date.now()}`;
}

function createEntry(
  skillId: string,
  label: string,
  statusText: string,
  state: ActivityState
): ActivityEntry {
  return {
    id: createId(),
    skillId,
    label,
    statusText,
    state,
    timestamp: Date.now(),
  };
}

/** Yield so the sidebar tree can repaint before long async work. */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Tracks one active skill operation at a time for the sidebar:
 * step 1 Loading skill, step 2 Installed/Done, plus a status detail panel.
 */
export class AgentActivityTracker implements vscode.Disposable {
  private currentOperation: ActivityOperation | undefined;
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  hasActiveOperation(): boolean {
    return this.currentOperation !== undefined;
  }

  getDisplaySteps(): readonly ActivityEntry[] {
    if (!this.currentOperation) {
      return [];
    }
    const { step1, step2 } = this.currentOperation;
    return step2 ? [step1, step2] : [step1];
  }

  getStatusDetail(): ActivityStatusDetail {
    return this.currentOperation?.status ?? IDLE_STATUS;
  }

  beginSkillOperation(skillId: string): void {
    const step1 = createEntry(skillId, 'Loading skill', '…', 'running');
    this.currentOperation = {
      skillId,
      step1,
      status: {
        skillId,
        phase: 'loading',
        detail: '…',
        timestamp: Date.now(),
      },
    };
    this.fireChange();
  }

  finishLoading(fileCount: number): void {
    const op = this.currentOperation;
    if (!op) {
      return;
    }
    const filesLabel = fileCount === 1 ? '1 file' : `${fileCount} files`;
    op.step1.statusText = filesLabel;
    op.step1.state = 'success';
    op.status = {
      skillId: op.skillId,
      phase: 'loading',
      detail: filesLabel,
      timestamp: Date.now(),
    };
    this.fireChange();
  }

  startInstalling(): void {
    const op = this.currentOperation;
    if (!op) {
      return;
    }
    op.step2 = createEntry(op.skillId, 'Installed', 'installing…', 'running');
    op.status = {
      skillId: op.skillId,
      phase: 'installing',
      detail: 'installing…',
      timestamp: Date.now(),
    };
    this.fireChange();
  }

  completeDone(): void {
    const op = this.currentOperation;
    if (!op?.step2) {
      return;
    }
    op.step2.statusText = 'done';
    op.step2.state = 'success';
    op.status = {
      skillId: op.skillId,
      phase: 'done',
      detail: 'success',
      timestamp: Date.now(),
    };
    this.fireChange();
  }

  /** Load-only path: step 2 is Done (no install phase). */
  completeLoadOnly(): void {
    const op = this.currentOperation;
    if (!op) {
      return;
    }
    op.step2 = createEntry(op.skillId, 'Done', 'success', 'success');
    op.status = {
      skillId: op.skillId,
      phase: 'done',
      detail: op.step1.statusText || 'loaded',
      timestamp: Date.now(),
    };
    this.fireChange();
  }

  fail(message: string): void {
    const op = this.currentOperation;
    if (!op) {
      return;
    }
    const short = message.length > 24 ? message.slice(0, 21) + '…' : message;
    const running = op.step2?.state === 'running' ? op.step2 : op.step1;
    running.statusText = short;
    running.state = 'error';
    if (op.step2 && running === op.step2) {
      op.step2.label = 'Failed';
    } else {
      op.step1.label = 'Failed';
    }
    op.status = {
      skillId: op.skillId,
      phase: 'failed',
      detail: short,
      timestamp: Date.now(),
    };
    this.fireChange();
  }

  clear(): void {
    this.currentOperation = undefined;
    this.fireChange();
  }

  private fireChange(): void {
    this._onDidChange.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
