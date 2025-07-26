
import 'fast-text-encoding';
import 'react-native-get-random-values';
import "react-native-url-polyfill/auto";
import '@ethersproject/shims';
import { Buffer } from 'buffer';

import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Provider as PaperProvider, Appbar } from "react-native-paper";
import { PrivyProvider } from '@privy-io/expo';
import { PrivyElements } from '@privy-io/expo/ui';
import { OverlayProvider, Chat, ChannelPreview, InlineUnreadIndicator } from "stream-chat-expo";
import { Tabs } from 'expo-router';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '../components/NotificationService';
import { chatClient } from '../config/chatConfig';
import { useAppStore } from './store/Store';
import { channel } from 'diagnostics_channel';
global.Buffer = Buffer;

const DARK_BG = "#18181b";
const DARK_NAV = "#18181b";

const streamChatTheme = {
  colors: {
    // Base colors
    white: '#ffffff', // Keep this for text
    white_snow: '#18181b', // Change this - likely the main background
    white_smoke: '#18181b', // Change this too
    black: '#ffffff', // Keep this for text on dark backgrounds
    grey: '#a1a1aa',
    grey_gainsboro: '#52525b',
    grey_whisper: '#3f3f46',

    // Accent colors
    accent_blue: '#3b82f6',
    accent_green: '#10b981',
    accent_red: '#ef4444',

    // Message colors
    blue_alice: '#1e1f35',
    transparent: 'transparent',
  },
  // Override specific component styles
  messageSimple: {
    content: {
      containerInner: {
        backgroundColor: '#27272a',
        borderColor: '#52525b',
        borderWidth: 1,
        borderRadius: 12,
      },
      textContainer: {
        backgroundColor: 'transparent',
      },
      markdown: {
        text: {
          color: '#ffffff',
        },
      },
    },
  },
  messageInput: {
    container: {
      backgroundColor: '#27272a',
      borderTopColor: '#52525b',
      borderTopWidth: 1,
    },
    inputBox: {
      borderColor: '#52525b',
      color: '#ffffff',
    },
  },
  // Add date separator styling
  dateSeparator: {
    container: {
      backgroundColor: 'transparent',
      marginVertical: 10,
    },
    text: {
      color: '#71717a',
      fontSize: 12,
      textAlign: 'center',
      backgroundColor: '#27272a',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      overflow: 'hidden',
    },
    line: {
      backgroundColor: '#52525b',
      height: 1,
    },
  },
  channelListFooterLoadingIndicator: {
    container: {
      backgroundColor: '#18181b',
    },
  },
  channelListLoadingIndicator: {
    container: {
      backgroundColor: '#18181b',
    },
  },
  messageList: {
    container: {
      backgroundColor: '#18181b',
    },
    inlineUnreadIndicator: {
      container: {
        backgroundColor: '#71717a',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
      },
      text: {
        color: '#ffffff',
        fontSize: 12,
      },
    },
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

function AppContent() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: DARK_NAV,
          borderTopWidth: 0,
          elevation: 4,
        },
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#a3a3a3",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Agent",
          tabBarIcon: ({ color }: { color: string }) => (
            <Appbar.Action icon="robot" iconColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }: { color: string }) => (
            <Appbar.Action icon="chat" iconColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="link"
        options={{
          title: "Link",
          tabBarIcon: ({ color }: { color: string }) => (
            <Appbar.Action icon="link" iconColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="buy"
        options={{
          title: "Buy",
          tabBarIcon: ({ color }: { color: string }) => (
            <Appbar.Action icon="currency-usd" iconColor={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }: { color: string }) => (
            <Appbar.Action icon="account" iconColor={color} />
          ),
        }}
      />
      <Tabs.Screen name="pay" options={{ href: null }} />
      <Tabs.Screen name="newchat" options={{ href: null }} />
      <Tabs.Screen name="channel/[cid]" options={{ href: null }} />
      <Tabs.Screen name="channel/[cid]/thread/[threadId]" options={{ href: null }} />
    </Tabs>
  );
}

export default function RootLayout() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const { username } = useAppStore();

  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    NotificationService.registerForPushNotificationsAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  const privyAppId = Constants.expoConfig?.extra?.privyAppId;
  const privyClientId = Constants.expoConfig?.extra?.privyClientId;

  if (!privyAppId || !privyClientId) {
    throw new Error('Missing required environment variables');
  }

  return (
    <SafeAreaProvider>
      <PrivyProvider appId={privyAppId} clientId={privyClientId}>
        <PrivyElements config={{ appearance: { colorScheme: "dark" } }} />
        <PaperProvider>
          <StatusBar style="light" backgroundColor={DARK_BG} />
          <SafeAreaView style={{ flex: 1, backgroundColor: DARK_BG }}>
            <GestureHandlerRootView style={styles.container}>
              <OverlayProvider value={{ style: streamChatTheme }}>
                {username && chatClient ? (
                  <Chat client={chatClient} enableOfflineSupport>
                    <AppContent />
                  </Chat>
                ) : (
                  <AppContent />
                )}
              </OverlayProvider>
            </GestureHandlerRootView>
          </SafeAreaView>
        </PaperProvider>
      </PrivyProvider>
    </SafeAreaProvider>
  );
}