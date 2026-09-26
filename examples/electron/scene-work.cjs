// Both execution lanes call this exact workload. No Electron or UI dependency.
const { performance } = require('node:perf_hooks');

function indexArtifact(count) {
  const started = performance.now();
  const artifact = JSON.stringify(Array.from({ length: count }, (_, i) => ({
    id: i, tool: ['read_file', 'search', 'build', 'write_note'][i % 4],
    path: `workspace/project-${i % 64}/src/module-${i % 1024}/file-${i}.ts`,
    status: i % 17 === 0 ? 'error' : 'complete',
    text: `Tool artifact ${i}: agent session ${i % 31}. Streaming output, approval policy, cancellation token, workspace index. ${i % 17 === 0 ? 'Error: unresolved import. Inspect dependency and retry after approval.' : 'Read completed; retain evidence and attach summary to the task.'}`,
  })));
  const sourceBytes = Buffer.byteLength(artifact);
  const parsed = JSON.parse(artifact);
  const index = parsed.map(row => {
    const words = `${row.path} ${row.status} ${row.text}`.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
    const unique = [...new Set(words)].sort();
    return { id: row.id, path: row.path, terms: unique, score: unique.filter(word => ['error', 'approval', 'agent', 'import'].includes(word)).length };
  });
  index.sort((a, b) => b.score - a.score || a.id - b.id);
  let checksum = 2166136261;
  let terms = 0;
  for (const row of index) {
    terms += row.terms.length;
    checksum = Math.imul(checksum ^ row.id, 16777619) >>> 0;
    for (const term of row.terms) for (let j = 0; j < term.length; j++) checksum = Math.imul(checksum ^ term.charCodeAt(j), 16777619) >>> 0;
  }
  return { count, sourceBytes, terms, checksum, computeMs: performance.now() - started, top: index.slice(0, 8).map(({ id, path, score }) => ({ id, path, score })) };
}

function toolEvent(index) {
  return { id: index, tool: `tool-${index % 24}`, status: index % 13 === 0 ? 'complete' : 'progress', text: `Task ${index % 31}: inspected workspace file ${index}. Retain this result for the agent timeline.` };
}

module.exports = { indexArtifact, toolEvent };
