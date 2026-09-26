const { parentPort, workerData } = require('node:worker_threads');
const { indexArtifact } = require('./scene-work.cjs');
try { parentPort.postMessage({ result: indexArtifact(workerData.count) }); }
catch (error) { parentPort.postMessage({ error: error.message }); }
