import { create } from "zustand";

interface IAppStore {
  deleting: boolean;
  setDeleting: (value: boolean) => void;
  accountLinked: boolean;
  setAccountLinked: (value: boolean) => void;
  pushTokenRegistered: boolean;
  setPushTokenRegistered: (value: boolean) => void;
}

export const useAppStore = create<IAppStore>((set) => ({
  deleting: false,
  setDeleting: (value: boolean) => set({ deleting: value }),
  accountLinked: false,
  setAccountLinked: (value: boolean) => set({ accountLinked: value }),
  pushTokenRegistered: false,
  setPushTokenRegistered: (value: boolean) => set({ pushTokenRegistered: value }),
}));
