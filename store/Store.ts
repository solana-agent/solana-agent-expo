import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Add preferred currency to the store interface and implementation:

interface IChatData {
  username: string | null;
  displayName: string | null;
  chatToken: string | null;
  avatarUrl: string | null;
  chatConnected: boolean;
  chatConnectAttempted: boolean;
  checkingUsername: boolean;
  preferredCurrency: string; // Add this field
}

interface IAppStore extends IChatData {
  deleting: boolean;
  setDeleting: (value: boolean) => void;
  accountLinked: boolean;
  setAccountLinked: (value: boolean) => void;
  pushTokenRegistered: boolean;
  setPushTokenRegistered: (value: boolean) => void;

  // Chat actions
  setUsername: (username: string | null) => void;
  setDisplayName: (displayName: string | null) => void;
  setChatToken: (token: string | null) => void;
  setAvatarUrl: (url: string | null) => void;
  setChatConnected: (connected: boolean) => void;
  setChatConnectAttempted: (attempted: boolean) => void;
  setCheckingUsername: (checking: boolean) => void;
  setPreferredCurrency: (currency: string) => void;
  setChatData: (data: Partial<IChatData>) => void;
  clearChatData: () => void;
}

export const useAppStore = create<IAppStore>()(
  persist(
    (set, get) => ({
      // Existing app state
      deleting: false,
      setDeleting: (value: boolean) => set({ deleting: value }),
      accountLinked: false,
      setAccountLinked: (value: boolean) => set({ accountLinked: value }),
      pushTokenRegistered: false,
      setPushTokenRegistered: (value: boolean) => set({ pushTokenRegistered: value }),

      // Chat state
      username: null,
      displayName: null,
      chatToken: null,
      avatarUrl: null,
      chatConnected: false,
      chatConnectAttempted: false,
      checkingUsername: false,
      preferredCurrency: 'USD', // Add default value

      // Chat actions
      setUsername: (username) => set({ username }),
      setDisplayName: (displayName) => set({ displayName }),
      setChatToken: (chatToken) => set({ chatToken }),
      setAvatarUrl: (avatarUrl) => set({ avatarUrl }),
      setChatConnected: (chatConnected) => set({ chatConnected }),
      setChatConnectAttempted: (chatConnectAttempted) => set({ chatConnectAttempted }),
      setCheckingUsername: (checkingUsername) => set({ checkingUsername }),
      setPreferredCurrency: (preferredCurrency) => set({ preferredCurrency }), // Add implementation

      // Batch update chat data
      setChatData: (data) => set((state) => ({ ...state, ...data })),

      // Clear all chat data (but keep preferred currency)
      clearChatData: () => set({
        username: null,
        displayName: null,
        chatToken: null,
        avatarUrl: null,
        chatConnected: false,
        chatConnectAttempted: false,
        checkingUsername: false,
        // Keep preferredCurrency when clearing
      }),
    }),
    {
      name: 'solana-agent-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist preferred currency
      partialize: (state) => ({
        username: state.username,
        displayName: state.displayName,
        chatToken: state.chatToken,
        avatarUrl: state.avatarUrl,
        preferredCurrency: state.preferredCurrency, // Add to persistence
      }),
    }
  )
);
