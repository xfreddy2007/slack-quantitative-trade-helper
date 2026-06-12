const NO_CITATIONS_MESSAGE = '無相關引用資料。'

export function renderExplain(rationale: string, citations: string[]): string {
  const sections = ['理由說明：', rationale, '', '引用來源：']
  if (citations.length > 0) {
    sections.push(...citations.map((c) => `- ${c}`))
  } else {
    sections.push(`- ${NO_CITATIONS_MESSAGE}`)
  }
  return sections.join('\n')
}
