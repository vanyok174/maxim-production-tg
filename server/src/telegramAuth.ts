import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    telegramUser?: { id: number; first_name?: string; username?: string };
  }
}

function validateInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return calculated === hash;
  } catch {
    return false;
  }
}

function parseUser(initData: string): { id: number; first_name?: string; username?: string } | null {
  const params = new URLSearchParams(initData);
  const raw = params.get('user');
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as { id: number; first_name?: string; username?: string };
    if (typeof u.id !== 'number') return null;
    return u;
  } catch {
    return null;
  }
}

function adminIds(): Set<number> {
  const raw = process.env.ADMIN_TELEGRAM_IDS || '';
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  return new Set(ids);
}

export function requireTelegramAdmin(req: Request, res: Response, next: NextFunction): void {
  if (process.env.DEV_SKIP_AUTH === '1') {
    req.telegramUser = { id: 0, first_name: 'dev' };
    next();
    return;
  }

  const botToken = process.env.BOT_TOKEN || '';
  if (!botToken) {
    res.status(500).json({ ok: false, error: 'BOT_TOKEN не задан' });
    return;
  }

  const initData =
    req.headers['x-telegram-init-data'] &&
    typeof req.headers['x-telegram-init-data'] === 'string'
      ? req.headers['x-telegram-init-data']
      : typeof req.body?.initData === 'string'
        ? req.body.initData
        : '';

  if (!initData || !validateInitData(initData, botToken)) {
    res.status(401).json({ ok: false, error: 'Неверные данные Telegram' });
    return;
  }

  const user = parseUser(initData);
  if (!user) {
    res.status(401).json({ ok: false, error: 'Нет пользователя в initData' });
    return;
  }

  const admins = adminIds();
  if (admins.size === 0) {
    res.status(500).json({
      ok: false,
      error: 'На сервере не задан ADMIN_TELEGRAM_IDS (telegram user id админов)',
    });
    return;
  }
  if (!admins.has(user.id)) {
    res.status(403).json({ ok: false, error: 'Доступ только для администратора' });
    return;
  }

  req.telegramUser = user;
  next();
}
