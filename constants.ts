import { NodeStatus } from './types';

export const NODE_WIDTH = 220; // Adjusted for new design
export const NODE_HEIGHT = 100; // Adjusted for new design
export const HISTORY_LIMIT = 50;

// Node status representations for dark theme
// These might be used for icons or subtle indicators, not primarily borders.
export const NODE_STATUS_CONFIG: { [key in NodeStatus]: { color: string; icon?: string } } = {
  [NodeStatus.ToDo]: { color: 'text-slate-400' },
  [NodeStatus.InProgress]: { color: 'text-yellow-400' },
  [NodeStatus.Done]: { color: 'text-green-400' },
  [NodeStatus.Blocked]: { color: 'text-red-400' },
};

// Kept for reference or if borders are reintroduced subtly
export const NODE_STATUS_BORDER_COLORS: { [key: string]: string } = {
  [NodeStatus.ToDo]: 'rgb(148 163 184)',
  [NodeStatus.InProgress]: 'rgb(250 204 21)',
  [NodeStatus.Done]: 'rgb(74 222 128)',
  [NodeStatus.Blocked]: 'rgb(248 113 113)',
};

// Constants for zoom functionality
export const INITIAL_VIEWBOX_WIDTH = 2000;
export const INITIAL_VIEWBOX_HEIGHT = 1500;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 3.0;
export const ZOOM_SENSITIVITY = 0.001;
export const PAN_SENSITIVITY = 1;

// Constants for node resizing
export const MIN_NODE_WIDTH = 120; // Adjusted
export const MIN_NODE_HEIGHT = 80; // Adjusted
export const RESIZE_HANDLE_SIZE = 10;

// Grid snapping
export const GRID_SIZE = 20; // Snap to 20px grid

// Dark theme color constants from Tailwind config (for JS access if needed)
export const COLORS = {
  darkBg: '#1F1C2D',
  darkSurface: '#2A263E',
  darkCard: '#3B3753',
  darkBorder: '#4A4566',
  darkTextPrimary: '#E0DFFD',
  darkTextSecondary: '#A09ECB',
  darkAccent: '#7B61FF',
  darkAccentHover: '#937FFF',
};
