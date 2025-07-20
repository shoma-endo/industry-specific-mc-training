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
