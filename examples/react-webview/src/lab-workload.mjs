export function logRows(count = 16000) {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1, text: `[${index % 5 === 0 ? 'tool' : 'assistant'}] event ${index + 1} · ${['workspace', 'approval', 'search', 'transcript'][index % 4]} · 项目记录 ${index % 97}` }));
}
export function rawLogs(count = 24000) {
  return Array.from({ length: count }, (_, index) => JSON.stringify({ id: index + 1, tool: ['read_file', 'search', 'write_note'][index % 3], status: index % 19 === 0 ? 'error' : 'complete', path: `docs/project-${index % 97}/note-${index}.md`, message: `任务记录 ${index + 1}: workspace review approval token-${index % 211}` }));
}
export function searchRow(raw, query) {
  const row = JSON.parse(raw);
  const text = `${row.id} ${row.tool} ${row.status} ${row.path} ${row.message}`;
  return text.toLocaleLowerCase().includes(query) ? { id: row.id, text } : null;
}
export function emptySearch() { return { count: 0, checksum: 0, preview: [], scanned: 0 }; }
export function addSearchResult(result, match) {
  result.scanned++;
  if (match) {
    result.count++;
    result.checksum = (result.checksum + match.id) % 1_000_000_007;
    if (result.preview.length < 60) result.preview.push(match);
  }
}
export function searchAll(raw, query) {
  const result = emptySearch(), needle = query.trim().toLocaleLowerCase();
  for (const row of raw) addSearchResult(result, searchRow(row, needle));
  return result;
}

// Deliberately small, actual Markdown-block parser for the transcript lab.
// It produces safe typed blocks; no innerHTML, regexp burn-loop or fake delay.
export function parseBlocks(markdown) {
  const blocks = [];
  let paragraph = [], code = null;
  const flush = () => { if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join('\n') }); paragraph = []; };
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) {
      flush();
      if (code === null) code = [];
      else { blocks.push({ kind: 'code', text: code.join('\n') }); code = null; }
    } else if (code !== null) code.push(line);
    else if (line.startsWith('# ')) { flush(); blocks.push({ kind: 'heading', text: line.slice(2) }); }
    else if (line.startsWith('- ')) { flush(); blocks.push({ kind: 'item', text: line.slice(2) }); }
    else if (!line.trim()) flush();
    else paragraph.push(line);
  }
  if (code !== null) blocks.push({ kind: 'code', text: code.join('\n') });
  flush();
  return blocks;
}
export const completedMessages = Array.from({ length: 100 }, (_, index) => `# 工具结果 ${index + 1}\n\n已检查 docs/project-${index % 17}。\n- 读取 README.md\n- 核对任务状态\n\n\`\`\`text\nrequest=${index + 1}\nstatus=complete\n\`\`\`\n`);
export const messageChunks = Array.from({ length: 160 }, (_, index) => index % 8 === 0 ? `\n# 进度 ${index + 1}\n` : `- 结果 ${index + 1} 已记录，等待下一步审阅。\n`);
