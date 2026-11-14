import { GoalsInput, MilestonesInput, StoryInput, ThanksInput } from '../ai/ai.models';
import { demoGoals, demoMilestones, demoStory, demoThanks } from '../ai/demo-writer';
import type { DesignInput, InviteTextInput, WhatsappInput } from '../ai/invite-prompts';
import { inviteWhatsappText } from '../guests';
import { designPicks, draftInviteText } from '../invite';
import { LlmProvider, LlmRequest } from './llm-provider';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Offline writer: the last tier of the AI chain, so every AI feature works with no key and no network. */
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
      case 'milestones':
        return JSON.stringify({ milestones: demoMilestones(req.input as MilestonesInput) });
      case 'invite': {
        const i = req.input as InviteTextInput;
        return JSON.stringify(draftInviteText(i.wedding, i.language, i.tone, i.template));
      }
      case 'whatsapp': {
        const i = req.input as WhatsappInput;
        return inviteWhatsappText(i.wedding, { name: i.greeting, greeting: i.greeting }, i.url, i.language);
      }
      case 'design': {
        const i = req.input as DesignInput;
        const p = designPicks(i.wedding, i.wishes);
        return JSON.stringify({ template: p.template, tone: p.tone, language: p.language, ...p.palette, reason: p.reason });
      }
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
