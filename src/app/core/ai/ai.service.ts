import { Injectable, inject } from '@angular/core';
import { LlmService } from '../llm/llm.service';
import { GoalSuggestions, GoalsInput, MilestonesInput, StoryInput, SuggestedMilestone, ThanksInput } from './ai.models';
import { cleanText, extractJson, goalsRequest, milestonesRequest, storyRequest, thanksRequest, validateGoals, validateMilestones } from './prompts';

/** The three AI features, independent of which provider (Gemini, Groq or Demo) is selected. */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly llm = inject(LlmService);

  /** Streams the story; `onText` receives the full text so far. Returns the cleaned final text. */
  async writeStory(input: StoryInput, onText: (text: string) => void, signal?: AbortSignal): Promise<string> {
    let text = '';
    for await (const chunk of this.llm.stream(storyRequest(input), signal)) {
      text += chunk;
      onText(text);
    }
    const final = cleanText(text);
    if (!final) throw new Error('The AI returned an empty story. Please try again.');
    onText(final);
    return final;
  }

  async suggestGoals(input: GoalsInput, signal?: AbortSignal): Promise<GoalSuggestions> {
    return validateGoals(extractJson(await this.llm.complete(goalsRequest(input), signal)));
  }

  async draftThanks(input: ThanksInput, signal?: AbortSignal): Promise<string> {
    const text = cleanText(await this.llm.complete(thanksRequest(input), signal));
    if (!text) throw new Error('The AI returned an empty note. Please try again.');
    return text;
  }

  async draftMilestones(input: MilestonesInput, signal?: AbortSignal): Promise<SuggestedMilestone[]> {
    return validateMilestones(extractJson(await this.llm.complete(milestonesRequest(input), signal)));
  }
}
