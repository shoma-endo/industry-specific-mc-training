import { parse } from 'csv-parse/sync';

export class SemrushService {
  private apiKey: string;
  private database: string;

  constructor() {
    // 環境変数からAPIキーを取得。未設定の場合はエラーを投げる
    if (!process.env.SEMRUSH_API_KEY) {
      throw new Error('SEMRUSH_API_KEY is not set in environment variables.');
    }
    this.apiKey = process.env.SEMRUSH_API_KEY;
    this.database = 'jp'; // 日本のデータベース
  }

  // 広告主（ドメイン）取得
  private async getAdvertisersByKeyword(keyword: string): Promise<string[]> {
    const url = `https://api.semrush.com/?type=phrase_adwords_historical&key=${this.apiKey}&phrase=${encodeURIComponent(
      keyword
    )}&database=${this.database}&display_limit=5&export_columns=Dn`;

    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `SEMrush API error (getAdvertisersByKeyword): ${res.status} ${res.statusText} - ${text}`
        );
      }
      console.log('text', text);
      if (/^ERROR 50 ::/.test(text)) {
        // 「該当するデータが見つからない」ことを示すコード :contentReference[oaicite:0]{index=0}
        return [];
      }

      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ';',
      });

      const domains = records.map((record: { Domain: string }) => record.Domain).filter(Boolean);
      return domains;
    } catch (error) {
      console.error('Error fetching advertisers:', error);
      return []; // エラー時は空配列を返す
    }
  }

  // 広告コピー取得
  private async getAdCopiesByDomain(
    domain: string
  ): Promise<{ title: string; description: string }[]> {
    const url = `https://api.semrush.com/?type=domain_adwords_unique&key=${this.apiKey}&domain=${domain}&database=${this.database}&display_limit=30&export_columns=Tt,Ds`;

    try {
      const res = await fetch(url);
      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `SEMrush API error (getAdCopiesByDomain): ${res.status} ${res.statusText} - ${text}`
        );
      }

      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ';',
      });

      return records
        .map((record: { Title: string; Description: string }) => ({
          title: record.Title,
          description: record.Description,
        }))
        .filter((ad: { title: string; description: string }) => ad.title && ad.description);
    } catch (error) {
      console.error(`Error fetching ad copies for domain ${domain}:`, error);
      return []; // エラー時は空配列を返す
    }
  }

  // メインアクション
  public async fetchAds(
    keyword: string
  ): Promise<{ domain: string; title: string; description: string }[]> {
    const advertisers = await this.getAdvertisersByKeyword(keyword);
    if (advertisers.length === 0) {
      return [];
    }

    const allAds: { domain: string; title: string; description: string }[] = [];

    // Promise.allを使用して並列処理
    const adPromises = advertisers.map((domain) => this.getAdCopiesByDomain(domain));
    
    const results = await Promise.all(adPromises);

    // 結果をフラット化してallAdsに追加
    for (let i = 0; i < advertisers.length; i++) {
      const domain = advertisers[i];
      const ads = results[i];
      if (!ads) continue;
      for (const ad of ads) {
        if (allAds.length < 30) {
          allAds.push({
            domain: domain || '',
            ...ad,
          });
        } else {
          break; // 30件に達したらループを抜ける
        }
      }
      if (allAds.length >= 30) break; // 外側のループも抜ける
    }

    return allAds; // 既に30件以下になっているはず
  }
}

// シングルトンインスタンスをエクスポート
export const semrushService = new SemrushService();
