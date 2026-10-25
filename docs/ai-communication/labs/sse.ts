export type SseEvent = { event: string; data: string };

// 教学子集：UTF-8、LF/CRLF、注释、event 和多行 data。
// 不实现单独 CR、id/retry、自动重连或 HTTP 状态/MIME 校验。
export async function* readEvents(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<SseEvent> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let event = 'message';
  let data: string[] = [];
  for await (const chunk of chunks) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, boundary).replace(/\r$/, '');
      buffer = buffer.slice(boundary + 1);
      if (line === '') {
        if (data.length) yield { event, data: data.join('\n') };
        event = 'message';
        data = [];
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') event = value || 'message';
      if (field === 'data') data.push(value);
    }
  }
  // 验证末尾没有截断 UTF-8；没有空行结束的事件按规范丢弃。
  decoder.decode();
}

export async function* splitBytes(text: string, size: number) {
  if (!Number.isInteger(size) || size <= 0) throw new Error('分片大小必须是正整数');
  const bytes = new TextEncoder().encode(text);
  for (let offset = 0; offset < bytes.length; offset += size) yield bytes.slice(offset, offset + size);
}
