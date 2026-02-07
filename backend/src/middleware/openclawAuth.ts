import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

const LOCAL_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const isLocalHost = (host?: string | null): boolean => {
  if (!host) return false;
  const hostname = host.split(':')[0]?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

const isLocalRequest = (req: Request): boolean => {
  const ip = req.ip || req.socket?.remoteAddress || '';
  if (LOCAL_IPS.has(ip)) return true;
  if (isLocalHost(req.hostname)) return true;
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return true;
  return false;
};

export const requireOpenClawAuth = (req: Request, res: Response, next: NextFunction) => {
  const allowRemote = config.OPENCLAW_ALLOW_REMOTE === true;

  if (!allowRemote && !isLocalRequest(req)) {
    return res.status(403).json({ error: 'Forbidden', message: 'OpenClaw API is local-only' });
  }

  const token = config.OPENCLAW_TOKEN;
  if (token) {
    const headerToken = req.header('X-OpenClaw-Token');
    if (!headerToken || headerToken !== token) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid OpenClaw token' });
    }
  }

  return next();
};

export const isLocalSocket = (remoteAddress?: string | null, host?: string | null, origin?: string | null) => {
  if (remoteAddress && LOCAL_IPS.has(remoteAddress)) return true;
  if (isLocalHost(host)) return true;
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return true;
  return false;
};
