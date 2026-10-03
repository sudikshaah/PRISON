'use client';
import { useEffect, useRef } from 'react';

const NODE_COLORS = {
  BLUE_STANDARD:   { fill: '#3B82F6', stroke: '#60A5FA', label: '#fff' },
  AMBER_HONEYPOT:  { fill: '#FFB800', stroke: '#FCD34D', label: '#000' },
  RED_MALICIOUS:   { fill: '#FF2D55', stroke: '#F87171', label: '#fff' },
  GREEN_CLEAN:     { fill: '#39FF14', stroke: '#86EFAC', label: '#000' },
};

const LAYOUT = {
  nodeR: 28,
  hPad: 140,
  vPad: 110,
  canvasW: 680,
  canvasH: 360,
};

function computePositions(nodes = [], edges = []) {
  if (!nodes || !nodes.length) return {};
  // Simple layered layout: BFS from roots
  const inDeg = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  (edges || []).forEach((e) => { if (inDeg[e.target] !== undefined) inDeg[e.target]++; });
  const layers = [];
  const assigned = new Set();
  let queue = nodes.filter((n) => inDeg[n.id] === 0);
  while (queue.length) {
    layers.push(queue.map((n) => n.id));
    queue.forEach((n) => assigned.add(n.id));
    const nextIds = new Set();
    (edges || []).forEach((e) => { if (assigned.has(e.source) && !assigned.has(e.target)) nextIds.add(e.target); });
    queue = nodes.filter((n) => nextIds.has(n.id));
  }
  // Assign remaining
  (nodes || []).forEach((n) => { if (!assigned.has(n.id)) { layers.push([n.id]); assigned.add(n.id); } });

  const posMap = {};
  const layerCount = layers.length;
  layers.forEach((layerIds, li) => {
    const x = LAYOUT.hPad + li * ((LAYOUT.canvasW - LAYOUT.hPad * 2) / Math.max(layerCount - 1, 1));
    layerIds.forEach((id, i) => {
      const y = LAYOUT.vPad + i * ((LAYOUT.canvasH - LAYOUT.vPad * 2) / Math.max(layerIds.length, 1))
        + (LAYOUT.canvasH - LAYOUT.vPad * 2) / (2 * Math.max(layerIds.length, 1));
      posMap[id] = { x, y };
    });
  });
  return posMap;
}

export default function AttackGraph({ dag, onNodeClick }) {
  const svgRef = useRef(null);
  if (!dag) return null;

  const { nodes, edges } = dag;
  const posMap = computePositions(nodes, edges);

  return (
    <div style={{ background: '#020408', borderRadius: 10, border: '1px solid rgba(0,255,240,0.15)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,255,240,0.04)', borderBottom: '1px solid rgba(0,255,240,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--cyan)', textTransform: 'uppercase' }}>
            ⬡ Attack Graph — TRACECOMMON DAG
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {Object.entries(NODE_COLORS).map(([type, c]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.fill }} />
              {type.split('_')[0]}
            </div>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${LAYOUT.canvasW} ${LAYOUT.canvasH}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.25)" />
          </marker>
          {/* Glow filters */}
          <filter id="glow-red"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="glow-amber"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="glow-blue"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * LAYOUT.canvasH / 7} x2={LAYOUT.canvasW} y2={i * LAYOUT.canvasH / 7}
            stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
        ))}

        {/* Edges */}
        {(edges || []).map((e, i) => {
          const s = posMap[e.source];
          const t = posMap[e.target];
          if (!s || !t) return null;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = dx / len; const ny = dy / len;
          const x1 = s.x + nx * LAYOUT.nodeR;
          const y1 = s.y + ny * LAYOUT.nodeR;
          const x2 = t.x - nx * (LAYOUT.nodeR + 4);
          const y2 = t.y - ny * (LAYOUT.nodeR + 4);
          // Bezier curve
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2 - 30;
          return (
            <g key={i}>
              <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} fill="none"
                strokeDasharray="4 3" markerEnd="url(#arrow)" />
              <text x={(x1+x2)/2} y={(y1+y2)/2 - 15} textAnchor="middle"
                fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="var(--font-mono)">
                {e.relationship}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {(nodes || []).map((node) => {
          const pos = posMap[node.id];
          if (!pos) return null;
          const colors = NODE_COLORS[node.node_type] || NODE_COLORS.BLUE_STANDARD;
          const filterMap = { RED_MALICIOUS: 'url(#glow-red)', AMBER_HONEYPOT: 'url(#glow-amber)', BLUE_STANDARD: 'url(#glow-blue)' };
          const truncLabel = node.label.length > 18 ? node.label.slice(0, 18) + '…' : node.label;
          return (
            <g key={node.id} className="graph-node" onClick={() => onNodeClick && onNodeClick(node)}
              style={{ cursor: 'pointer' }}>
              {/* Glow ring for threats */}
              {node.node_type !== 'BLUE_STANDARD' && (
                <circle cx={pos.x} cy={pos.y} r={LAYOUT.nodeR + 8}
                  fill="none" stroke={colors.fill} strokeWidth={1} opacity={0.3}
                  style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
              )}
              <circle cx={pos.x} cy={pos.y} r={LAYOUT.nodeR}
                fill={colors.fill} stroke={colors.stroke} strokeWidth={2}
                filter={filterMap[node.node_type] || ''}
                opacity={0.92} />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle"
                fill={colors.label} fontSize={9} fontFamily="var(--font-mono)" fontWeight={700}>
                {node.comm.toUpperCase()}
              </text>
              <text x={pos.x} y={pos.y + 3} dy="16" textAnchor="middle"
                fill="rgba(255,255,255,0.7)" fontSize={7.5} fontFamily="var(--font-mono)">
                PID {node.pid}
              </text>
              <text x={pos.x} y={pos.y + LAYOUT.nodeR + 14} textAnchor="middle"
                fill={colors.fill} fontSize={8} fontFamily="var(--font-mono)">
                {truncLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
