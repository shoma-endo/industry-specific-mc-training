import { ChatMessage } from '@/server/services/openAiService';
import { googleSearchAction } from '@/server/handler/actions/googleSearch.actions';
import { openAiService } from '@/server/services/openAiService';
import { GOOGLE_SEARCH_CATEGORIZATION_PROMPT } from '@/lib/prompts';

export class ChatProcessorService {
  extractKeywordSections(text: string): { immediate: string[]; later: string[] } {
    const extractSection = (source: string | undefined): string[] =>
      source
        ?.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0) ?? [];

    const matchBetween = text.match(/【今すぐ客キーワード】([\s\S]*?)【後から客キーワード】/);
    const matchImmediateOnly = text.match(/【今すぐ客キーワード】([\s\S]*)/);
    const matchLater = text.match(/【後から客キーワード】([\s\S]*)$/);

    let immediate: string[] = [];
    let later: string[] = [];

    if (matchBetween) {
      immediate = extractSection(matchBetween[1]);
      later = extractSection(matchLater?.[1]);
    } else if (matchImmediateOnly) {
      immediate = extractSection(matchImmediateOnly[1]);
    } else if (matchLater) {
      later = extractSection(matchLater[1]);
    } else {
      immediate = extractSection(text);
    }

    return { immediate, later };
  }

  async generateAIResponsesFromTitles(
    input: { query: string; searchResult: string }[]
  ): Promise<{ query: string; aiMessage: string }[]> {
    const tasks = input.map(async ({ query, searchResult }) => {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: GOOGLE_SEARCH_CATEGORIZATION_PROMPT,
        },
        {
          role: 'user',
          content: `キーワード【${query}】\n検索結果【${searchResult}】`,
        },
      ];

      try {
        const aiResponse = await openAiService.sendMessage(messages, 'gpt-4.1-nano-2025-04-14');
        return { query, aiMessage: aiResponse.message || '' };
      } catch (error) {
        console.error(`AI処理に失敗しました (query: "${query}"):`, error);
        return { query, aiMessage: '' };
      }
    });

    return Promise.all(tasks);
  }

  async handleGoogleSearch(keywords: string[], token: string): Promise<{ query: string; searchResult: string }[]> {
    const searchPromises = keywords.map(async query => {
      try {
        const searchResultData = await googleSearchAction({ liffAccessToken: token, query });
        const searchResult = searchResultData.items
          .map(item => `タイトル: ${item.title}\nスニペット: ${item.snippet}`)
          .join('\n');
        return { query, searchResult };
      } catch (error) {
        console.error(`Critical error searching for "${query}":`, error);
        return { query, searchResult: '' };
      }
    });

    const resultsArray = await Promise.all(searchPromises);
    return resultsArray;
  }

  parseAdItems(input: string) {
    const lines = input.split('\n');
    const adItems: Array<{
      headline: string;
      description: string;
      displayPath?: string;
    }> = [];

    let currentItem: {
      headline?: string;
      description?: string;
      displayPath?: string;
    } = {};
    let currentProperty: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('見出し:')) {
        if (currentItem.headline && currentItem.description) {
          adItems.push({
            headline: currentItem.headline,
            description: currentItem.description,
            ...(currentItem.displayPath && { displayPath: currentItem.displayPath }),
          });
          currentItem = {};
        }
        currentItem.headline = trimmedLine.replace('見出し:', '').trim();
        currentProperty = 'headline';
      } else if (trimmedLine.startsWith('説明文:')) {
        currentItem.description = trimmedLine.replace('説明文:', '').trim();
        currentProperty = 'description';
      } else if (trimmedLine.startsWith('表示パス:')) {
        currentItem.displayPath = trimmedLine.replace('表示パス:', '').trim();
        currentProperty = 'displayPath';
      } else if (trimmedLine && currentProperty) {
        if (currentProperty === 'headline' && currentItem.headline) {
          currentItem.headline += ' ' + trimmedLine;
        } else if (currentProperty === 'description' && currentItem.description) {
          currentItem.description += ' ' + trimmedLine;
        } else if (currentProperty === 'displayPath' && currentItem.displayPath) {
          currentItem.displayPath += ' ' + trimmedLine;
        }
      }
    }

    if (currentItem.headline && currentItem.description) {
      adItems.push({
        headline: currentItem.headline,
        description: currentItem.description,
        ...(currentItem.displayPath && { displayPath: currentItem.displayPath }),
      });
    }

    return adItems.filter(item => item.headline && item.description);
  }
}