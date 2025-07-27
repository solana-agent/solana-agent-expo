export default {
  expo: {
    name: "Solana Agent",
    slug: "solana-agent",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    scheme: "agent",
    updates: {
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/c4be3be9-44ef-4714-b0e3-f73a100eb895"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    android: {
      package: "com.stablethread.solanaagent",
      allowBackup: false,
      adaptiveIcon: {
        foregroundImage: "./assets/android-logo.png"
      },
      googleServicesFile: "./google-services.json",
      splash: {
        image: "./assets/android-logo.png",
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        dark: {
          image: "./assets/android-logo.png",
          resizeMode: "contain",
          backgroundColor: "#000000"
        }
      },
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "sol-pay.co",
              pathPrefix: "/pay"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        },
        {
          action: "VIEW",
          data: [
            {
              scheme: "agent"
            }
          ],
          category: [
            "BROWSABLE",
            "DEFAULT"
          ]
        }
      ]
    },
    extra: {
      eas: {
        projectId: "c4be3be9-44ef-4714-b0e3-f73a100eb895"
      },
      // Environment variables
      privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID,
      privyClientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID,
      streamChatApiKey: process.env.EXPO_PUBLIC_STREAM_CHAT_API_KEY,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      wsUrl: process.env.EXPO_PUBLIC_WS_URL,
    },
    owner: "komdodx",
    plugins: [
      "expo-router",
      "expo-localization",
      "expo-build-properties",
      "expo-asset",
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-local-authentication",
        {
          faceIDPermission: "Allow Solana Agent to use biometric authentication for secure access."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#6d28d9",
          defaultChannel: "transactions"
        }
      ],
      [
        "expo-media-library",
        {
          photosPermission: "Allow Solana Agent to access your photos.",
          savePhotosPermission: "Allow Solana Agent to save photos.",
          isAccessMediaLocationEnabled: true
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Solana Agent accesses your photos to let you share them with your friends."
        }
      ],
      [
        "expo-video",
        {
          supportsBackgroundPlayback: true,
          supportsPictureInPicture: true
        }
      ],
      [
        "expo-audio",
        {
          microphonePermission: "Allow Solana Agent to access your microphone."
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Solana Agent to use your location."
        }
      ]
    ],
    notification: {
      icon: "./assets/icon.png",
      color: "#6d28d9",
      androidMode: "default",
      androidCollapsedTitle: "Solana Agent"
    },
    runtimeVersion: {
      policy: "appVersion"
    }
  }
};
