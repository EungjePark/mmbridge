export type HookEvent =
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PreReview'
  | 'PostReview'
  | 'MessageReceived'
  | 'MessageSent';

type HookHandler = (ctx: Record<string, unknown>) => Promise<void>;

export class HookRegistry {
  private readonly hooks: Map<HookEvent, HookHandler[]> = new Map();

  register(event: HookEvent, handler: HookHandler): void {
    const handlers = this.hooks.get(event) ?? [];
    handlers.push(handler);
    this.hooks.set(event, handlers);
  }

  async emit(event: HookEvent, context: Record<string, unknown>): Promise<void> {
    const handlers = this.hooks.get(event) ?? [];
    for (const handler of handlers) {
      try {
        await handler(context);
      } catch (err) {
        // Log but don't throw — hooks should not break the main flow
        console.error(`[mmbridge] Hook error on ${event}:`, err);
      }
    }
  }

  clear(event?: HookEvent): void {
    if (event !== undefined) {
      this.hooks.delete(event);
    } else {
      this.hooks.clear();
    }
  }
}
