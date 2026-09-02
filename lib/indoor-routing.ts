export type IndoorCoordinate = { lat: number; lng: number };
export type IndoorRouteSegment = { id: string; level?: string; kind?: string; coordinates: IndoorCoordinate[] };
export type IndoorLandmark = IndoorCoordinate & { id: string; name: string; category?: string; level?: string };
export type LandmarkFallbackRoute = { route: IndoorCoordinate[]; landmarks: IndoorLandmark[] };

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

function levelMatches(landmark: IndoorLandmark, level?: string | null) {
  if (!level || !landmark.level) return true;
  return landmark.level.split(';').map((x) => x.trim()).includes(level);
}

export function landmarkFallbackPath(
  landmarks: IndoorLandmark[],
  start: IndoorCoordinate,
  end: IndoorCoordinate,
  level?: string | null,
): LandmarkFallbackRoute | null {
  const direct = indoorDistanceMeters(start, end);
  if (direct < 12) return { route: [start, end], landmarks: [] };

  const usable = landmarks
    .filter((item) => levelMatches(item, level))
    .filter((item) => indoorDistanceMeters(item, start) > 4 && indoorDistanceMeters(item, end) > 4)
    .filter((item) => indoorDistanceMeters(item, start) <= direct * 1.35 + 80 || indoorDistanceMeters(item, end) <= direct * 1.35 + 80)
    .slice(0, 420);

  if (!usable.length) return null;

  type Node = IndoorCoordinate & { id: string; landmark?: IndoorLandmark };
  const nodes: Node[] = [
    { ...start, id: '__start' },
    ...usable.map((item) => ({ ...item, id: item.id, landmark: item })),
    { ...end, id: '__end' },
  ];
  const endIndex = nodes.length - 1;
  const maxLink = Math.min(85, Math.max(38, direct / 4));
  const edges = new Map<number, Array<{ to: number; weight: number }>>();
  for (let i = 0; i < nodes.length; i++) edges.set(i, []);

  for (let i = 0; i < nodes.length; i++) {
    const ranked: Array<{ j: number; d: number }> = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const d = indoorDistanceMeters(nodes[i], nodes[j]);
      if (d <= maxLink || (i === 0 && d <= 95) || (j === endIndex && d <= 95)) ranked.push({ j, d });
    }
    ranked.sort((a, b) => a.d - b.d);
    for (const candidate of ranked.slice(0, 8)) {
      const progressBefore = indoorDistanceMeters(nodes[i], end);
      const progressAfter = indoorDistanceMeters(nodes[candidate.j], end);
      const backwardsPenalty = progressAfter > progressBefore + 20 ? 1.45 : 1;
      const categoryPenalty = nodes[candidate.j].landmark?.category === 'Corridoio' ? 0.92 : 1;
      edges.get(i)!.push({ to: candidate.j, weight: candidate.d * backwardsPenalty * categoryPenalty });
    }
  }

  const dist = new Array(nodes.length).fill(Number.POSITIVE_INFINITY);
  const prev = new Array<number>(nodes.length).fill(-1);
  const visited = new Array(nodes.length).fill(false);
  dist[0] = 0;

  for (let count = 0; count < nodes.length; count++) {
    let current = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited[i] && dist[i] < best) { best = dist[i]; current = i; }
    }
    if (current < 0 || current === endIndex) break;
    visited[current] = true;
    for (const edge of edges.get(current) ?? []) {
      const candidate = dist[current] + edge.weight;
      if (candidate < dist[edge.to]) {
        dist[edge.to] = candidate;
        prev[edge.to] = current;
      }
    }
  }

  if (!Number.isFinite(dist[endIndex])) return null;
  const indexes: number[] = [];
  let cursor = endIndex;
  while (cursor >= 0) {
    indexes.push(cursor);
    if (cursor === 0) break;
    cursor = prev[cursor];
  }
  if (indexes[indexes.length - 1] !== 0) return null;
  indexes.reverse();

  const route = indexes.map((index) => ({ lat: nodes[index].lat, lng: nodes[index].lng }));
  const usedLandmarks = indexes.slice(1, -1).map((index) => nodes[index].landmark).filter(Boolean) as IndoorLandmark[];
  if (!usedLandmarks.length && direct > 80) return null;
  const fallbackLength = routeLengthMeters(route);
  if (fallbackLength > direct * 1.9 + 120) return null;
  return { route, landmarks: usedLandmarks };
}

export function routeLengthMeters(route: IndoorCoordinate[]) {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += indoorDistanceMeters(route[i - 1], route[i]);
  return total;
}

export function advanceAlongRoute(route: IndoorCoordinate[], current: IndoorCoordinate, stepMeters = 0.7) {
  if (route.length < 2) return { position: current, reached: true };
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < route.length; i++) {
    const d = indoorDistanceMeters(current, route[i]);
    if (d < nearestDistance) { nearestDistance = d; nearestIndex = i; }
  }
  let remaining = Math.min(Math.max(stepMeters, 0.05), 0.7);
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
