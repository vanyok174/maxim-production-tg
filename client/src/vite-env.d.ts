/// <reference types="vite/client" />

interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, unknown>;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
