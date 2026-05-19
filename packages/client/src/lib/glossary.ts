export interface GlossaryEntry {
  term: string;
  short: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  '시가총액': { term: '시가총액 (Market Cap)', short: '주가 × 발행 주식 수. 시장이 매기는 이 회사의 총 가격.' },
  'EV': { term: '기업가치 (EV)', short: '시가총액 + 순차입금. 회사를 통째로 사려면 필요한 금액.' },
  'PER': { term: 'P/E (PER)', short: '주가를 주당순이익으로 나눈 배수. 높으면 시장이 성장을 크게 기대.' },
  'PBR': { term: 'PBR', short: '주가를 주당순자산으로 나눈 배수. 1배 미만은 자산 가치 대비 저평가.' },
  'PSR': { term: 'PSR', short: '주가를 주당매출로 나눈 배수. 성장주 비교에 유용.' },
  'EBITDA': { term: 'EBITDA', short: '영업이익 + 감가상각비. 실질 현금 창출 능력.' },
  'ROE': { term: 'ROE', short: '자기자본 대비 순이익 비율. 높을수록 자본을 잘 굴림.' },
  '배당수익률': { term: '배당수익률', short: '주당 배당금 ÷ 주가. 배당으로 받는 연간 수익률.' },
  '52주 최고': { term: '52주 최고', short: '최근 52주(약 252거래일) 동안의 최고가.' },
  '52주 최저': { term: '52주 최저', short: '최근 52주 동안의 최저가.' },
  '거래량': { term: '거래량', short: '해당 기간 동안 거래된 주식 수.' },
};

export function getGlossary(label: string): GlossaryEntry | undefined {
  if (GLOSSARY[label]) return GLOSSARY[label];
  return Object.values(GLOSSARY).find((e) => {
    const firstWord = e.term.split(' ')[0];
    return firstWord ? label.includes(firstWord) : false;
  });
}
