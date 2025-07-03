import 'fast-text-encoding';
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import '@ethersproject/shims';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import React, { useEffect, useRef } from "react";
import "react-native-url-polyfill/auto";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { PrivyProvider } from '@privy-io/expo';
import { Provider as PaperProvider } from "react-native-paper";
import { PrivyElements } from '@privy-io/expo/ui';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '../components/NotificationService';
import { Tabs } from 'expo-router';
import { Appbar } from "react-native-paper";

const DARK_BG = "#18181b";
const DARK_NAV = "#18181b";

export default function RootLayout() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    // Register for push notifications
    NotificationService.registerForPushNotificationsAsync();

    // Listen for notifications while app is running
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle notification tap - could navigate to specific screen
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <PrivyProvider
        appId='cmbg6lx1p00j5kv0lhl0oza2k'
        clientId="client-WY6MAFAZkqFfpULJUoBxVNCMFv9qcxbLSztP8Nd1Gs4aL"
      >
        <PrivyElements config={{ appearance: { colorScheme: "dark" }}} />
        <PaperProvider>
          <StatusBar style="light" backgroundColor={DARK_BG} />
          <SafeAreaView style={{ flex: 1, backgroundColor: DARK_BG }}>
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
                  title: "Chat",
                  tabBarIcon: ({ color }: { color: string }) => (
                    <Appbar.Action icon="chat" iconColor={color} />
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
              <Tabs.Screen
                name="pay"
                options={{
                  href: null, // Hide from tabs
                }}
              />
            </Tabs>
          </SafeAreaView>
        </PaperProvider>
      </PrivyProvider>
    </SafeAreaProvider>
  );
}
