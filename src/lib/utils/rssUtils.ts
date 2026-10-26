import { XMLParser } from 'fast-xml-parser';

export interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  thumbnail?: string;
  source: string; // 数据来源标识：interview-questions / hub
}

interface RSSSource {
  url: string;
  count: number;
  source: string;
}

// 数据源配置：各取3条
const RSS_SOURCES: RSSSource[] = [
  { url: 'https://www.senseiai.me/interview-questions/rss', count: 3, source: 'interview-questions' },
  { url: 'https://www.senseiai.me/hub/rss', count: 3, source: 'hub' },
];

// 解析单个RSS数据
function parseRSSData(xmlData: string, count: number, source: string): RSSItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });
  
  const result = parser.parse(xmlData);
  const items = result.rss?.channel?.item || [];
  
  return items.slice(0, count).map((item: any) => {
    let thumbnail = item['media:thumbnail']?.['@_url'] || null;
    // 解码URL编码的缩略图链接
    if (thumbnail) {
      try {
        thumbnail = decodeURIComponent(thumbnail);
      } catch (error) {
        console.warn('Failed to decode thumbnail URL:', thumbnail);
      }
    }
    
    return {
      title: item.title || '',
      description: item.description || '',
      link: item.link || '',
      pubDate: item.pubDate || new Date().toISOString(),
      thumbnail,
      source,
    };
  });
}

// 获取单个RSS数据源
async function fetchSingleRSS(source: RSSSource): Promise<RSSItem[]> {
  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} for ${source.url}`);
    }
    const xmlData = await response.text();
    return parseRSSData(xmlData, source.count, source.source);
  } catch (error) {
    console.error(`Error fetching RSS from ${source.url}:`, error);
    return [];
  }
}

// 静态构建时获取所有 RSS 数据。
export async function fetchRSSData(): Promise<RSSItem[]> {
  try {
    // 并行请求两个数据源
    const results = await Promise.all(RSS_SOURCES.map(fetchSingleRSS));
    // 交替合并：interview-questions 一条、hub 一条，保持多样性
    const merged: RSSItem[] = [];
    const maxLen = Math.max(results[0].length, results[1].length);
    for (let i = 0; i < maxLen; i++) {
      if (results[0][i]) merged.push(results[0][i]);
      if (results[1][i]) merged.push(results[1][i]);
    }
    
    return merged;
  } catch (error) {
    console.error('Error fetching RSS data:', error);
    return [];
  }
}
