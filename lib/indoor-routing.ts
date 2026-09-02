export type IndoorCoordinate = { lat: number; lng: number };
export type IndoorRouteSegment = { id: string; level?: string; kind?: string; coordinates: IndoorCoordinate[] };

type GraphEdge = { to: string; weight: number };
type GraphNode = IndoorCoordinate & { key: string };

const keyOf = (p: IndoorCoordinate) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

export function indoorDistanceMeters(a: IndoorCoordinate, b: IndoorCoordinate) {
  const r = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function sameLevel(segmentLevel?: string, wantedLevel?: string | null) {
  if (!wantedLevel) return true;
  if (!segmentLevel) return true;
  return segmentLevel.split(';').map((x) => x.trim()).includes(wantedLevel);
}

function buildGraph(segments: IndoorRouteSegment[], level?: string | null) {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge[]>();
  const addNode = (p: IndoorCoordinate) => {
    const key = keyOf(p);
    if (!nodes.has(key)) nodes.set(key, { ...p, key });
    if (!edges.has(key)) edges.set(key, []);
    return key;
  };
  const addEdge = (a: string, b: string, weight: number) => {
    edges.get(a)?.push({ to: b, weight });
    edges.get(b)?.push({ to: a, weight });
  };

  for (const segment of segments) {
    if (!sameLevel(segment.level, level) || segment.coordinates.length < 2) continue;
    for (let i = 1; i < segment.coordinates.length; i++) {
      const a = segment.coordinates[i - 1];
      const b = segment.coordinates[i];
      const ak = addNode(a);
      const bk = addNode(b);
      addEdge(ak, bk, indoorDistanceMeters(a, b));
    }
  }
  return { nodes, edges };
}

function nearestNode(nodes: Map<string, GraphNode>, point: IndoorCoordinate) {
  let best: GraphNode | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of nodes.values()) {
    const d = indoorDistanceMeters(node, point);
    if (d < bestDistance) { best = node; bestDistance = d; }
  }
  return best ? { node: best, distance: bestDistance } : null;
}

export function shortestIndoorPath(
  segments: IndoorRouteSegment[],
  start: IndoorCoordinate,
  end: IndoorCoordinate,
  level?: string | null,
  maxSnapMeters = 45,
): IndoorCoordinate[] | null {
  const { nodes, edges } = buildGraph(segments, level);
  if (!nodes.size) return null;
  const startSnap = nearestNode(nodes, start);
  const endSnap = nearestNode(nodes, end);
  if (!startSnap || !endSnap || startSnap.distance > maxSnapMeters || endSnap.distance > maxSnapMeters) return null;

  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const unvisited = new Set(nodes.keys());
  for (const key of unvisited) distances.set(key, Number.POSITIVE_INFINITY);
  distances.set(startSnap.node.key, 0);

  while (unvisited.size) {
    let current: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const key of unvisited) {
      const d = distances.get(key) ?? Number.POSITIVE_INFINITY;
      if (d < currentDistance) { current = key; currentDistance = d; }
    }
    if (!current || currentDistance === Number.POSITIVE_INFINITY) break;
    unvisited.delete(current);
    if (current === endSnap.node.key) break;
    for (const edge of edges.get(current) ?? []) {
      if (!unvisited.has(edge.to)) continue;
      const candidate = currentDistance + edge.weight;
      if (candidate < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.to, candidate);
        previous.set(edge.to, current);
      }
    }
  }

  if (startSnap.node.key !== endSnap.node.key && !previous.has(endSnap.node.key)) return null;
  const keys: string[] = [];
  let cursor = endSnap.node.key;
  keys.push(cursor);
  while (cursor !== startSnap.node.key) {
    const prev = previous.get(cursor);
    if (!prev) return null;
    cursor = prev;
    keys.push(cursor);
  }
  keys.reverse();
  const path = keys.map((key) => nodes.get(key)).filter(Boolean).map((node) => ({ lat: node!.lat, lng: node!.lng }));
  return [start, ...path, end];
}

export function routeLengthMeters(route: IndoorCoordinate[]) {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += indoorDistanceMeters(route[i - 1], route[i]);
  return total;
}

export function advanceAlongRoute(route: IndoorCoordinate[], current: IndoorCoordinate, stepMeters = 4) {
  if (route.length < 2) return { position: current, reached: true };
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.length; i++) {
    const d = indoorDistanceMeters(current, route[i]);
    if (d < nearestDistance) { nearestDistance = d; nearestIndex = i; }
  }
  let remaining = stepMeters;
  let from = current;
  for (let i = Math.max(1, nearestIndex + 1); i < route.length; i++) {
    const to = route[i];
    const distance = indoorDistanceMeters(from, to);
    if (distance <= remaining) {
      remaining -= distance;
      from = to;
      if (i === route.length - 1) return { position: to, reached: true };
      continue;
    }
    const ratio = distance > 0 ? remaining / distance : 1;
    return {
      position: { lat: from.lat + (to.lat - from.lat) * ratio, lng: from.lng + (to.lng - from.lng) * ratio },
      reached: false,
    };
  }
  return { position: route[route.length - 1], reached: true };
}
