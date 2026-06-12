import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { useAppStore } from './data/store';
import './styles/tokens.css';
import './styles/global.css';

// 新バージョン検出時はトーストで知らせ、ユーザー操作で適用する(無言の差し替えをしない)
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    useAppStore.getState().setApplyUpdate(() => void updateSW(true));
  },
});

// iOSのストレージ追い出し対策(§5.G): 永続ストレージを要求する
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  void navigator.storage.persist();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
