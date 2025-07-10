import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Chat, OverlayProvider } from "stream-chat-expo";
import type { DeepPartial, Theme } from 'stream-chat-react-native';
import { chatClient, getChatUser } from "../config/chatConfig";

const getDarkTheme = (): DeepPartial<Theme> => ({
  colors: {
    black: '#FFFFFF',
    white: '#18181b',
    grey: '#a3a3a3',
    grey_gainsboro: '#2d2d30',
    grey_whisper: '#1a1a1a',
    white_snow: '#18181b',
    white_smoke: '#1e1e1e',
    accent_blue: '#3b82f6',
    accent_green: '#10b981',
    accent_red: '#ef4444',
    bg_gradient_start: '#18181b',
    bg_gradient_end: '#18181b',
    primary: '#3b82f6',
    secondary: '#6b7280',
    border: '#374151',
    targetedMessageBackground: '#2d2d30',
  },
  messageSimple: {
    content: {
      containerInner: {
        backgroundColor: '#1e1e1e',
        borderColor: '#374151',
      },
    },
  },
  channelListMessenger: {
    flatList: {
      backgroundColor: '#18181b',
    },
  },
  channelPreview: {
    container: {
      backgroundColor: '#18181b',
    },
    title: {
      color: '#FFFFFF',
    },
  },
  messageInput: {
    container: {
      backgroundColor: '#1e1e1e',
      borderTopColor: '#374151',
    },
  },
});

export const StreamChatWrapper = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(getDarkTheme());
  const user = getChatUser();

  useEffect(() => {
    setTheme(getDarkTheme());
  }, []);

  if (!chatClient || !user.id) {
    return (
      <SafeAreaView style={{ backgroundColor: '#18181b', flex: 1 }}>
        <Text style={{ color: "#fff", textAlign: "center", marginTop: 50 }}>
          Loading chat...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <OverlayProvider value={{ style: theme }}>
      <Chat client={chatClient} enableOfflineSupport>
        {children}
      </Chat>
    </OverlayProvider>
  );
};
