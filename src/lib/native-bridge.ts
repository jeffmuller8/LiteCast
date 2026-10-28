// The Mac app (macos/) injects window.LiteCastMac into its web view. macPlugin() wraps it in
// the same shape as a Capacitor plugin, so native-audio.ts and native-auth.ts use one
// interface for both the Android and Mac apps.

import type { PluginListenerHandle } from "@capacitor/core";

interface MacBridge {
  platform: "macos";
  plugins: string[];
  call(plugin: string, method: string, args?: object): Promise<unknown>;
  addListener(plugin: string, event: string, listener: (data: never) => void): { remove(): void };
}

declare global {
  interface Window {
    LiteCastMac?: MacBridge;
  }
}

function macBridge(): MacBridge | null {
  return typeof window === "undefined" ? null : window.LiteCastMac ?? null;
}

export function hasMacPlugin(name: string) {
  return macBridge()?.plugins.includes(name) ?? false;
}

export function macPlugin<T>(name: string): T {
  return new Proxy({} as object, {
    get(_, method) {
      // Not a promise; keeps `await plugin` and similar checks from treating it as one
      if (method === "then" || typeof method !== "string") return undefined;
      if (method === "addListener") {
        return (event: string, listener: (data: never) => void): Promise<PluginListenerHandle> => {
          const handle = macBridge()!.addListener(name, event, listener);
          return Promise.resolve({ remove: async () => handle.remove() });
        };
      }
      return (args?: object) => macBridge()!.call(name, method, args);
    },
  }) as T;
}
