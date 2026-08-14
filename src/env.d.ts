/// <reference types="vite/client" />

interface ElectronAPI {
  exit: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
