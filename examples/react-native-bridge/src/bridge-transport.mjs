// Only rendered state snapshots may coalesce. Native capability commands remain
// independent. Patches are diffed against the last WRITTEN tree, never a dropped
// pending tree, so stdout backpressure cannot create a missing-patch baseline.
export function createBridgeTransport(write = (payload) => process.stdout.write(payload)) {
  let busy = false, pending = null, baseline = null, serial = 0;
  let lastRun = '', sent = 0, commits = 0, coalesced = 0, encodeTotal = 0;
  function flatten(nodes, result = new Map()) {
    for (const node of nodes) {
      if (node.props.id) result.set(node.props.id, { type: node.type, props: node.props, children: node.children.map((child) => child.props.id) });
      flatten(node.children, result);
    }
    return result;
  }
  const sameValue = (a, b) => Object.is(a, b) || (a && b && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
  const sameProps = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => sameValue(a[key], b[key]));
  function transmit(snapshot) {
    if (busy) { if (pending) coalesced++; pending = snapshot; return; }
    const begin = performance.now();
    const current = flatten(snapshot.tree);
    const stableStructure = baseline && baseline.size === current.size && [...current].every(([id, node]) => baseline.get(id)?.type === node.type && sameValue(baseline.get(id)?.children, node.children));
    let packet;
    if (snapshot.patch && stableStructure) {
      const changes = [...current].filter(([id, node]) => !sameProps(baseline.get(id).props, node.props)).map(([id, node]) => ({ id, props: node.props }));
      packet = { type: 'render.patch', serial: ++serial, changes };
    } else packet = { type: 'render', serial: ++serial, tree: snapshot.tree };
    const core = JSON.stringify(packet);
    const encodeMs = performance.now() - begin;
    encodeTotal += encodeMs; sent++;
    const metric = { run: snapshot.run, sent, commits, coalesced, encodeMs, encodeTotal, mode: packet.type };
    // Host counts the actual whole-line byte length. encodeMs covers tree diff
    // and core JSON serialization, excluding this small metrics envelope.
    const payload = core.slice(0, -1) + ',"bridge":' + JSON.stringify(metric) + '}\n';
    baseline = current;
    busy = !write(payload);
    if (busy) process.stdout.once('drain', () => { busy = false; if (pending) { const next = pending; pending = null; transmit(next); } });
  }
  return {
    commit(tree, { patch = false, run = 'app' } = {}) {
      if (run !== lastRun) { lastRun = run; sent = 0; commits = 0; coalesced = 0; encodeTotal = 0; }
      commits++;
      transmit({ tree, patch, run });
    }
  };
}
