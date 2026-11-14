import { Injectable, inject } from '@angular/core';
import { DesignPick } from '../invite';
import { AiTier } from '../llm/llm-chain';
import { LlmService } from '../llm/llm.service';
import { InviteText } from '../models';
import { GoalSuggestions, GoalsInput, MilestonesInput, StoryInput, SuggestedMilestone, ThanksInput } from './ai.models';
import {
  DesignInput, InviteTextInput, WhatsappInput, designRequest, inviteTextRequest, validateDesign, validateInviteText, validateWhatsapp, whatsappRequest,
} from './invite-prompts';
import { cleanText, extractJson, goalsRequest, milestonesRequest, storyRequest, thanksRequest, validateGoals, validateMilestones } from './prompts';

export interface Written<T> {
  value: T;
  tier: AiTier;
}

/**
 * Every AI feature, independent of who writes (own key, Chrome's on-device AI, free cloud AI or
 * offline templates). Replies are validated; one that fails validation moves down the chain.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly llm = inject(LlmService);

  /** Streams the story; `onText` receives the full text so far. Returns the cleaned final text. */
  async writeStory(input: StoryInput, onText: (text: string) => void, signal?: AbortSignal): Promise<string> {
    let text = '';
    for await (const chunk of this.llm.stream({ ...storyRequest(input), language: input.language }, signal)) {
      text += chunk;
      onText(text);
    }
    const final = cleanText(text);
    if (!final) throw new Error('The AI returned an empty story. Please try again.');
    onText(final);
    return final;
  }

  async suggestGoals(input: GoalsInput, signal?: AbortSignal): Promise<GoalSuggestions> {
    return (await this.llm.run(goalsRequest(input), (t) => validateGoals(extractJson(t)), signal)).value;
  }

  async draftThanks(input: ThanksInput, signal?: AbortSignal): Promise<string> {
    return (await this.llm.run({ ...thanksRequest(input), language: input.language }, nonEmpty, signal)).value;
  }

  async draftMilestones(input: MilestonesInput, signal?: AbortSignal): Promise<SuggestedMilestone[]> {
    const req = { ...milestonesRequest(input), language: input.language };
    return (await this.llm.run(req, (t) => validateMilestones(extractJson(t)), signal)).value;
  }

  async inviteText(input: InviteTextInput, signal?: AbortSignal): Promise<Written<InviteText>> {
    return this.llm.run(inviteTextRequest(input), (t) => validateInviteText(extractJson(t), input), signal);
  }

  async whatsappMessage(input: WhatsappInput, signal?: AbortSignal): Promise<Written<string>> {
    return this.llm.run(whatsappRequest(input), (t) => validateWhatsapp(t, input), signal);
  }

  async designPicks(input: DesignInput, signal?: AbortSignal): Promise<Written<DesignPick>> {
    return this.llm.run(designRequest(input), (t) => validateDesign(extractJson(t)), signal);
  }
}

function nonEmpty(text: string): string {
  const t = cleanText(text);
  if (!t) throw new Error('The AI returned an empty note.');
  return t;
}
