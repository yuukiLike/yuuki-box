// Order-sensitive 32-bit rolling fingerprint of complete JSON records.
// UTF-16 code units; diagnostic only, not a cryptographic integrity check.
const fingerprintSeed = 2166136261;
function fingerprintRecord(previous, record) {
  const text = JSON.stringify(record) + '\n';
  let hash = previous;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  return hash;
}
module.exports = { fingerprintSeed, fingerprintRecord };
