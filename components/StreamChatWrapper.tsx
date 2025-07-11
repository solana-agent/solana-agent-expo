import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Chat, OverlayProvider } from "stream-chat-expo";
import type { DeepPartial, Theme } from 'stream-chat-react-native';
import { usePrivy } from "@privy-io/expo";
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
  const { user, isReady } = usePrivy();
  const chatUser = getChatUser();

  console.log('=== StreamChatWrapper render ===');
  console.log('isReady:', isReady);
  console.log('user:', !!user);
  console.log('chatClient:', !!chatClient);
  console.log('chatUser.id:', chatUser.id);

  useEffect(() => {
    setTheme(getDarkTheme());
  }, []);

  // If Privy isn't ready yet, show loading but don't block everything
  if (!isReady) {
    console.log('=== StreamChatWrapper: Privy not ready ===');
    return (
      <SafeAreaView style={{ backgroundColor: '#18181b', flex: 1 }}>
        <Text style={{ color: "#fff", textAlign: "center", marginTop: 50 }}>
          Loading...
        </Text>
      </SafeAreaView>
    );
  }

  // If user is not logged in, just render children without chat wrapper
  if (!user) {
    console.log('=== StreamChatWrapper: No user, rendering children directly ===');
    return <>{children}</>;
  }

  // If user is logged in and chat is ready, wrap with Stream Chat
  if (chatClient && chatUser.id) {
    console.log('=== StreamChatWrapper: Chat ready, wrapping with Stream Chat ===');
    return (
      <OverlayProvider value={{ style: theme }}>
        <Chat client={chatClient} enableOfflineSupport>
          {children}
        </Chat>
      </OverlayProvider>
    );
  }

  // User is logged in but chat isn't ready - just render children without blocking
  console.log('=== StreamChatWrapper: User logged in but chat not ready, rendering children ===');
  return <>{children}</>;
};
