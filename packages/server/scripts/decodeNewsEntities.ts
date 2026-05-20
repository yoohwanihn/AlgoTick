// 일회성: 기존 news_items에 저장된 HTML entity를 일괄 decode.
// Usage: npx tsx scripts/decodeNewsEntities.ts
import { getPrisma, disconnectPrisma } from '../src/db.js';
import { decodeHtmlEntities } from '../src/util/html.js';

async function main() {
  const prisma = getPrisma();
  // 의심 row만 추리기 (전체 스캔 비용 절감)
  const candidates = await prisma.news.findMany({
    where: {
      OR: [
        { title: { contains: '&' } },
        { summary: { contains: '&' } },
      ],
    },
  });
  console.log(`candidates: ${candidates.length}`);
  let updated = 0;
  for (const r of candidates) {
    const newTitle = decodeHtmlEntities(r.title);
    const newSummary = r.summary ? decodeHtmlEntities(r.summary) : null;
    if (newTitle === r.title && newSummary === r.summary) continue;
    await prisma.news.update({
      where: { id: r.id },
      data: { title: newTitle, summary: newSummary },
    });
    updated++;
  }
  console.log(`updated: ${updated}`);
  await disconnectPrisma();
}

void main().catch((e) => { console.error(e); process.exit(1); });
