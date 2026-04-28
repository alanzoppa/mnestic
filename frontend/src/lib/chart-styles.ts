import type { CSSProperties } from 'react';

export const TOOLTIP_STYLE: { contentStyle: CSSProperties } = {
  contentStyle: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '0.5rem',
    color: '#fafafa',
  },
} as const;

export const CARTESIAN_GRID = { strokeDasharray: '3 3', stroke: '#27272a' } as const;

export const X_AXIS_DARK = {
  stroke: '#52525b',
  tick: { fill: '#a1a1aa', fontSize: 11 },
} as const;

export const Y_AXIS_DARK = {
  stroke: '#52525b',
  tick: { fill: '#a1a1aa', fontSize: 12 },
} as const;
