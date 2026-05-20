// 자주 등장하는 HTML named entity 매핑.
const NAMED: Record<string, string> = {
  '&quot;': '"',
  '&apos;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&ldquo;': '“',
  '&rdquo;': '”',
};

/**
 * 외부 뉴스 API 응답의 HTML entity를 텍스트로 변환.
 * 네이버 뉴스는 title/body에 &quot; 같은 entity를 raw로 넣어 보냄.
 * Yahoo/Finnhub도 가끔 동일 케이스 발생.
 *
 * 이중 인코딩(&amp;quot; → &quot; → ")까지 처리하기 위해 2회 적용.
 */
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return '';
  let out = input;
  for (let i = 0; i < 2; i++) {
    out = out.replace(/&[a-zA-Z]+;/g, (m) => NAMED[m] ?? m);
    out = out.replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
    out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
  }
  return out;
}
