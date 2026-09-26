import { emptySearch, addSearchResult, searchRow } from './lab-workload.mjs';

let rows = [], active = null;
function cancelActive() {
  if (!active) return;
  clearTimeout(active.timer);
  postMessage({ type: 'cancelled', id: active.id, result: active.result, computeMs: active.computeMs });
  active = null;
}
onmessage = ({ data }) => {
  if (data.type === 'init') { cancelActive(); rows = data.rows; postMessage({ type: 'ready', rows: rows.length }); return; }
  if (data.type === 'cancel') { cancelActive(); return; }
  if (data.type !== 'search' || typeof data.query !== 'string') return;
  cancelActive();
  const job = { id: data.id, query: data.query.trim().toLocaleLowerCase(), result: emptySearch(), cursor: 0, started: performance.now(), computeMs: 0, timer: null };
  active = job;
  function step() {
    if (active !== job) return;
    const begin = performance.now(), end = Math.min(job.cursor + 300, rows.length);
    while (job.cursor < end) addSearchResult(job.result, searchRow(rows[job.cursor++], job.query));
    job.computeMs += performance.now() - begin;
    if (job.cursor < rows.length) job.timer = setTimeout(step, 0); // Yield so cancellation/new generations can be received.
    else { active = null; postMessage({ type: 'result', id: job.id, result: job.result, computeMs: job.computeMs, elapsedMs: performance.now() - job.started }); }
  }
  step();
};
