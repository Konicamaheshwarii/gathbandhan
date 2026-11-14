import { GoalsInput, StoryInput, ThanksInput } from '../ai/ai.models';
import { demoGoals, demoStory, demoThanks } from '../ai/demo-writer';
import { LlmProvider, LlmRequest } from './llm-provider';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Offline writer so every AI feature works without an API key. */
export class DemoProvider implements LlmProvider {
  constructor(private readonly delayMs = 600) {}

  async complete(req: LlmRequest): Promise<string> {
    await sleep(this.delayMs);
    switch (req.task) {
      case 'goals':
        return JSON.stringify(demoGoals(req.input as GoalsInput));
      case 'thanks':
        return demoThanks(req.input as ThanksInput);
      case 'story':
        return demoStory(req.input as StoryInput);
      default:
        return '{"ok":true}';
    }
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    const text = req.task === 'thanks' ? demoThanks(req.input as ThanksInput) : demoStory(req.input as StoryInput);
    for (const piece of text.match(/\S+\s*/g) ?? []) {
      if (signal?.aborted) return;
      await sleep(this.delayMs / 25);
      yield piece;
    }
  }
}
