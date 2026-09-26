const { Worker } = require('node:worker_threads');
const { join } = require('node:path');
const { performance } = require('node:perf_hooks');
const { indexArtifact, toolEvent } = require('./scene-work.cjs');
const { fingerprintSeed, fingerprintRecord } = require('./scene-fingerprint.cjs');

// One active experiment; bounded IPC windows prevent a naive run from leaving
// an unbounded queue behind. Acknowledgements are identical in both modes.
class SceneController {
  constructor(send) { this.send = send; this.active = null; this.closing = false; }

  start(options) {
    if (!options || !['ipc', 'cpu'].includes(options.scene) || !['naive', 'optimized'].includes(options.mode) ||
        typeof options.runId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(options.runId) ||
        !(options.scene === 'ipc' ? [2000, 10000, 30000] : [20000, 80000, 200000]).includes(options.count)) throw new Error('Invalid scene options.');
    // Do not queue a hidden start that could outlive the requesting UI.
    // Keep the slot occupied until terminate() has observed its actual exit.
    if (this.active?.termination) throw new Error('上一次 Worker 正在退出；退出完成后请重新点击运行。');
    if (this.closing) throw new Error('Scene controller is closing.');
    if (this.active) throw new Error('Stop the active experiment before starting another.');
    const run = { ...options, started: performance.now(), index: 0, messages: 0, bytes: 0, checksum: fingerprintSeed, checkpoint: 0, worker: null, deadline: null, scheduled: null, cancelling: false, termination: null, workerResult: null, workerError: null };
    this.active = run;
    run.scheduled = setImmediate(() => {
      if (this.active !== run) return;
      if (run.scene === 'ipc') return this.sendWindow(run);
      if (run.mode === 'naive') {
        try { this.finish(run, { type: 'result', result: indexArtifact(run.count) }); }
        catch (error) { this.finish(run, { type: 'error', message: error.message }); }
      } else {
        try {
          const worker = new Worker(join(__dirname, 'scene-worker.cjs'), { workerData: { count: run.count } });
          run.worker = worker;
          worker.once('message', message => { run.workerResult = message; });
          worker.once('error', error => { run.workerError = error.message; });
          worker.once('exit', code => {
            if (run.cancelling) return this.finish(run, { type: 'cancelled', received: run.index });
            const message = run.workerResult;
            if (run.workerError || code !== 0 || message?.error || !message?.result) return this.finish(run, { type: 'error', message: run.workerError || message?.error || `Worker exited before a successful result (${code}).` });
            // Complete means the result exists AND this Worker has exited.
            this.finish(run, { type: 'result', result: message.result });
          });
        } catch (error) { this.finish(run, { type: 'error', message: error.message }); }
      }
    });
    return { runId: run.runId };
  }

  sendWindow(run) {
    const end = Math.min(run.count, run.index + 200);
    while (run.index < end) {
      const batchEnd = Math.min(end, run.index + (run.mode === 'optimized' ? 200 : 1));
      const records = [];
      while (run.index < batchEnd) {
        const record = toolEvent(run.index);
        records.push(record);
        run.checksum = fingerprintRecord(run.checksum, record);
        run.index++;
      }
      const event = { type: 'records', runId: run.runId, records, checkpoint: run.index === end ? end : null };
      // Serialized payload size, not a claim about physical IPC transport bytes.
      run.bytes += Buffer.byteLength(JSON.stringify(event));
      run.messages++;
      this.send(event);
    }
    run.checkpoint = end;
    run.deadline = setTimeout(() => this.finish(run, { type: 'error', message: 'Renderer did not acknowledge the bounded window within 30 seconds.' }), 30000);
  }

  acknowledge(options) {
    const run = this.active;
    if (!run || run.scene !== 'ipc' || options?.runId !== run.runId) return { stale: true };
    if (!Number.isInteger(options.checkpoint) || options.checkpoint <= 0 || options.checkpoint !== run.checkpoint) throw new Error('Unexpected scene checkpoint.');
    clearTimeout(run.deadline);
    run.checkpoint = 0; // Reject duplicate acknowledgements before the next window.
    if (run.index === run.count) this.finish(run, { type: 'result', result: { count: run.index, checksum: run.checksum, messages: run.messages, payloadBytes: run.bytes } });
    else run.scheduled = setImmediate(() => { if (this.active === run) this.sendWindow(run); });
    return { accepted: true };
  }

  finish(run, event) {
    if (this.active !== run) return;
    clearTimeout(run.deadline);
    clearImmediate(run.scheduled);
    this.active = null;
    this.send({ ...event, runId: run.runId, elapsedMs: performance.now() - run.started });
  }

  async stop(runId) {
    const run = this.active;
    if (!run || run.runId !== runId) return { stopped: false, reason: 'already finished or superseded' };
    // Main-thread CPU work cannot receive this request while blocked. The UI
    // reports that honestly; worker mode can be terminated before completion.
    if (run.worker) {
      run.cancelling = true;
      if (!run.termination) run.termination = run.worker.terminate();
      await run.termination;
    } else this.finish(run, { type: 'cancelled', received: run.index });
    return { stopped: true };
  }

  close() { this.closing = true; return this.active ? this.stop(this.active.runId) : Promise.resolve({ stopped: false }); }
}

module.exports = { SceneController };
