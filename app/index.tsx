import {
  PrivyUser,
  useEmbeddedSolanaWallet,
  usePrivy,
} from "@privy-io/expo";
import { useDelegatedActions, useLogin } from "@privy-io/expo/ui";
import Constants from "expo-constants";
import * as Network from "expo-network";
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Text as RNText,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Hyperlink from "react-native-hyperlink";
import NfcManager, { Ndef, NfcEvents } from "react-native-nfc-manager";
import {
  Appbar,
  Button,
  Card,
  Modal,
  Provider as PaperProvider,
  Portal,
  Text,
} from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { BiometricService } from "../components/BiometricService";
import { PushNotificationService } from '../components/PushNotificationService';
import { useAppStore } from "./store/Store";
import { UsernameSetup } from "../components/UsernameSetup";
import {
  connectChatUser,
  fetchExistingUserData,
} from "../config/chatConfig";

const API_URL = Constants.expoConfig?.extra?.apiUrl;
const WS_URL = Constants.expoConfig?.extra?.wsUrl;

// Tailwind colors
const PURPLE_800 = "#6d28d9";
const BLUE_400 = "#60a5fa";
const DARK_BG = "#18181b";
const DARK_OVERLAY = "rgba(24,24,27,0.85)";

type ChatMessage = {
  id: string;
  user_message: string;
  assistant_message: string;
  timestamp: number;
};

type ChatHistory = {
  data: ChatMessage[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

// Update the PaymentRequest interface to match the backend structure
type PaymentRequest = {
  id: string;
  amount: number;
  currency: string;
  token: string;
  payee: string;
  payer: string;
  dueDate: number;
  status: 'outstanding' | 'accepted' | 'paid' | 'rejected' | 'expired';
  type: 'AR' | 'AP';
  externalId?: string;
  memo?: string;
  createdAt: string;
  link: string;
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    size: number;
  }>;
  human: string;
  to?: string;
};

function isWalletDelegated(user: PrivyUser | null) {
  return user?.linked_accounts?.some(
    (account: any) => account.type === "wallet" && account.delegated
  );
}

function InfiniteScrollChat({
  userId,
  getAccessToken,
  processed,
  deleted,
  accountLinked,
  wsStreaming,
  onScrollToBottom,
}: {
  userId: string;
  getAccessToken: () => Promise<string | null>;
  processed: boolean;
  deleted: boolean;
  accountLinked: boolean;
  wsStreaming: boolean;
  onScrollToBottom: () => void;
}) {
  const [chatHistory, setChatHistory] = useState<ChatHistory>({
    data: [],
    total: 0,
    page: 1,
    page_size: 0,
    total_pages: 0,
  });
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [allDataFetched, setAllDataFetched] = useState(false);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Fetch paginated chat history
  const fetchData = useCallback(
    async (pageNumber: number) => {
      if (!userId) return;
      setFetchLoading(true);
      try {
        const jwt = await getAccessToken();
        const url = `${API_URL}/history/${userId}?page_num=${pageNumber}&page_size=10`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });
        const data = await response.json();
        if (response.status !== 200) {
          setFetchError(true);
          return;
        }
        setChatHistory((prev) => ({
          ...data,
          data: [...prev.data, ...data.data],
        }));
        setAllDataFetched(data.page >= data.total_pages);
        setInitialFetchDone(true);
      } catch (error) {
        console.error("Error fetching chat history:", error);
        setFetchError(true);
      } finally {
        setFetchLoading(false);
      }
    },
    [userId, getAccessToken]
  );

  // Initial and refresh fetch
  useEffect(() => {
    setChatHistory({
      data: [],
      total: 0,
      page: 1,
      page_size: 0,
      total_pages: 0,
    });
    setAllDataFetched(false);
    setInitialFetchDone(false);
    setFetchError(false);
    if (userId) fetchData(1);
  }, [userId, processed, deleted, accountLinked, fetchData]);

  // Scroll to bottom when new message arrives (from websocket)
  useEffect(() => {
    if (wsStreaming && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        onScrollToBottom();
      }, 100);
    }
  }, [wsStreaming, chatHistory.data.length, onScrollToBottom]);

  // Load more when user scrolls to top (for inverted list, this is onEndReached)
  const handleEndReached = () => {
    if (!fetchLoading && !allDataFetched && initialFetchDone) {
      fetchData(chatHistory.page + 1);
    }
  };

  return (
    <>
      {fetchError && (
        <View style={{ padding: 16, backgroundColor: '#dc2626', margin: 16, borderRadius: 8 }}>
          <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 8 }}>
            Failed to load chat history
          </Text>
          <Button
            mode="outlined"
            onPress={() => {
              setFetchError(false);
              fetchData(1); // Retry loading first page
            }}
            labelStyle={{ color: '#fff' }}
            style={{ borderColor: '#fff' }}
          >
            Retry
          </Button>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={chatHistory.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <Card style={[styles.card, styles.youCard]}>
              <Card.Title title="You" titleStyle={styles.youText} />
              <Card.Content>
                <Text style={styles.youText}>{item.user_message}</Text>
              </Card.Content>
            </Card>
            <Card style={[styles.card, { marginTop: 10 }, styles.agentCard]}>
              <Card.Title title="Agent" titleStyle={styles.agentText} />
              <Card.Content>
                <Hyperlink
                  linkDefault={true}
                  linkStyle={{ color: "#a5b4fc" }}
                  onPress={async (url) => {
                    try {
                      await Linking.openURL(url);
                    } catch { }
                  }}
                >
                  <Text style={styles.agentText}>{item.assistant_message}</Text>
                </Hyperlink>
              </Card.Content>
            </Card>
          </View>
        )}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.1}
        contentContainerStyle={styles.flatListContent}
        ListFooterComponent={
          fetchLoading ? (
            <ActivityIndicator color="#fff" />
          ) : fetchError ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: '#f87171', marginBottom: 8 }}>
                Error loading more messages
              </Text>
              <Button
                mode="text"
                onPress={() => {
                  setFetchError(false);
                  fetchData(chatHistory.page + 1);
                }}
                labelStyle={{ color: '#60a5fa' }}
              >
                Try Again
              </Button>
            </View>
          ) : null
        }
        inverted
      />
    </>
  );
}

// Delegation button using useDelegatedActions from @privy-io/expo/ui
function DelegateWalletButton({
  user,
  wallet,
  onDelegated,
}: {
  user: PrivyUser;
  wallet: any;
  onDelegated: () => void;
}) {
  const { delegateWallet } = useDelegatedActions();
  const [error, setError] = useState<string | null>(null);

  // Find the embedded wallet to delegate
  const walletToDelegate =
    wallet?.wallets && wallet.wallets.length > 0 && wallet.wallets[0]?.address
      ? wallet.wallets[0]
      : null;

  // Check if already delegated
  const isAlreadyDelegated = !!user?.linked_accounts?.find(
    (account: any) => account.type === "wallet" && account.delegated
  );

  const onDelegate = async () => {
    setError(null);
    if (!walletToDelegate) {
      setError("No wallet found to delegate.");
      return;
    }
    try {
      await delegateWallet({ address: walletToDelegate.address, chainType: "solana" });
      onDelegated();
    } catch (err: any) {
      setError(err?.message || "Failed to delegate wallet.");
    }
  };

  return (
    <View style={{ alignItems: "center" }}>
      <Button
        mode="contained"
        onPress={onDelegate}
        disabled={isAlreadyDelegated || !walletToDelegate}
        style={{ marginBottom: 20, width: 200, backgroundColor: PURPLE_800 }}
        labelStyle={{ color: "#fff" }}
      >
        {isAlreadyDelegated ? "Wallet Delegated" : "Delegate Access"}
      </Button>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const ALLOWED_FIAT = [
  'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNH', 'COP', 'EUR', 'GBP', 'IDR',
  'INR', 'JPY', 'KRW', 'MXN', 'NOK', 'NZD', 'PEN', 'PHP', 'SEK', 'SGD',
  'TRY', 'TWD', 'USD', 'ZAR',
];

function currencySymbol(fiat: string | undefined | null): string {
  if (!fiat) return '';
  if (!ALLOWED_FIAT.includes(fiat)) return '';
  switch (fiat) {
    case 'AUD': return '$';
    case 'BRL': return '$';
    case 'CAD': return '$';
    case 'CHF': return 'CHF';
    case 'CLP': return '$';
    case 'CNH': return '¥';
    case 'COP': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'IDR': return 'Rp';
    case 'INR': return '₹';
    case 'JPY': return '¥';
    case 'KRW': return '₩';
    case 'MXN': return '$';
    case 'NOK': return 'kr';
    case 'NZD': return '$';
    case 'PEN': return 'S/';
    case 'PHP': return '₱';
    case 'SEK': return 'kr';
    case 'SGD': return '$';
    case 'TRY': return '₺';
    case 'TWD': return '$';
    case 'USD': return '$';
    case 'ZAR': return 'R';
    default: return '';
  }
}

function currencyName(fiat: string | undefined): string {
  if (!fiat) return '';
  if (!ALLOWED_FIAT.includes(fiat)) return '';
  switch (fiat) {
    case 'AUD': return 'Australian Dollars';
    case 'BRL': return 'Brazilian Reais';
    case 'CAD': return 'Canadian Dollars';
    case 'CHF': return 'Swiss Francs';
    case 'CLP': return 'Chilean Pesos';
    case 'CNH': return 'Chinese Yuan';
    case 'COP': return 'Colombian Pesos';
    case 'EUR': return 'Euros';
    case 'GBP': return 'British Pounds';
    case 'IDR': return 'Indonesian Rupiah';
    case 'INR': return 'Indian Rupees';
    case 'JPY': return 'Japanese Yen';
    case 'KRW': return 'South Korean Won';
    case 'MXN': return 'Mexican Pesos';
    case 'NOK': return 'Norwegian Kroner';
    case 'NZD': return 'New Zealand Dollars';
    case 'PEN': return 'Peruvian Soles';
    case 'PHP': return 'Philippine Pesos';
    case 'SEK': return 'Swedish Kronor';
    case 'SGD': return 'Singapore Dollars';
    case 'TRY': return 'Turkish Lira';
    case 'TWD': return 'New Taiwan Dollars';
    case 'USD': return 'United States Dollars';
    case 'ZAR': return 'South African Rand';
    default: return '';
  }
}

// Update the parseAgentTransferUri function to handle new link format
function parseAgentTransferUri(uri: string, username: string | null): {
  paymentId: string | null;
  valid: boolean;
  human: string;
} {
  try {
    console.log('Parsing URI:', uri);

    let paymentId: string | null = null;

    // Clean up the URI of non-ASCII characters
    uri = uri.replace(/[^\x00-\x7F]/g, '');

    // Handle Universal Links for payment requests: https://sol-pay.co/pay/{paymentId}
    if (uri.startsWith("https://sol-pay.co/pay/")) {
      try {
        const url = new URL(uri);
        const pathParts = url.pathname.split('/');
        paymentId = pathParts[pathParts.length - 1]; // Get the last part (payment ID)

        console.log('Universal Link - Parsed payment ID:', paymentId);
      } catch (error) {
        console.error('Error parsing Universal Link:', error);
        return {
          paymentId: null,
          human: "Invalid payment link: unable to parse",
          valid: false,
        };
      }
    }
    // Handle custom scheme: agent://pay/{paymentId}
    else if (uri.startsWith("agent://pay/")) {
      paymentId = uri.replace("agent://pay/", "");
      console.log('Custom scheme - Parsed payment ID:', paymentId);
    }
    else {
      return {
        paymentId: null,
        human: "Invalid URI: must be a payment request link",
        valid: false,
      };
    }

    if (!paymentId) {
      return {
        paymentId: null,
        human: "Invalid URI: payment ID is required",
        valid: false,
      };
    }

    return {
      paymentId,
      human: `Loading payment request: ${paymentId}`,
      valid: true,
    };
  } catch (error) {
    console.error('Error parsing URI:', error);
    return {
      paymentId: null,
      human: "Invalid payment link",
      valid: false,
    };
  }
}

// Add function to fetch payment request details
const fetchPaymentRequest = async (paymentId: string, getAccessToken: () => Promise<string | null>): Promise<PaymentRequest | null> => {
  try {
    const jwt = await getAccessToken();
    if (!jwt) return null;

    const response = await fetch(`${API_URL}/payment/request/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch payment request:', response.status);
      return null;
    }

    const data = await response.json();
    return data.request;
  } catch (error) {
    console.error('Error fetching payment request:', error);
    return null;
  }
};

export default function Chat() {
  // Get URL params from Expo Router
  const params = useLocalSearchParams();

  // All hooks must be called before any return!
  const [error, setError] = useState("");
  const [hasError, setHasError] = useState(false);
  const { deleting, accountLinked } = useAppStore();
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [textInputValue, setTextInputValue] = useState("");
  const [wsStreaming, setWsStreaming] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [walletCreating, setWalletCreating] = useState(false);
  const [walletCreateError, setWalletCreateError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Biometric authentication state
  const [isAppActive, setIsAppActive] = useState(true);
  const [requiresBiometric, setRequiresBiometric] = useState(false);
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);
  const [biometricCheckedThisSession, setBiometricCheckedThisSession] = useState(false);

  // Deep link handling - separate from pending NFC
  const [pendingDeepLinkParams, setPendingDeepLinkParams] = useState<any>(null);
  const [deepLinkProcessed, setDeepLinkProcessed] = useState(false);

  // Add loading state for payment requests
  const [loadingPaymentRequest, setLoadingPaymentRequest] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Privy authentication
  const { isReady, user, getAccessToken } = usePrivy();
  const wallet = useEmbeddedSolanaWallet();
  const { create } = useEmbeddedSolanaWallet();
  const { login } = useLogin();

  const walletAddress =
    wallet?.wallets && wallet.wallets.length > 0 && wallet.wallets[0]?.address
      ? wallet.wallets[0]?.address
      : null;

  // Check if already delegated (calculated after user hook)
  const alreadyDelegated = isWalletDelegated(user);

  const {
    username,
    chatToken,
    chatConnected,
    chatConnectAttempted,
    checkingUsername,
    setUsername,
    setDisplayName,
    setChatConnected,
    setChatConnectAttempted,
    setCheckingUsername,
    setChatData,
    clearChatData
  } = useAppStore();

  // Check for stored username and connect to chat
  useEffect(() => {
    const initializeChat = async () => {
      console.log('=== initializeChat called ===');

      if (!user || chatConnectAttempted) {
        console.log('=== Skipping chat initialization ===');
        setCheckingUsername(false);
        return;
      }

      try {
        console.log('=== Starting chat initialization... ===');
        setChatConnectAttempted(true);

        // Check if we already have stored data in Zustand
        if (username && chatToken) {
          console.log('=== Found stored data in Zustand, using directly ===');
          setChatConnected(true);
          setCheckingUsername(false);
          return;
        }

        // If no stored data, check server
        console.log('=== Checking server for existing username... ===');
        const serverData = await fetchExistingUserData(getAccessToken);

        if (serverData.username && serverData.chatToken) {
          console.log('=== Found existing username on server ===');

          // Update store with server data
          setChatData({
            username: serverData.username,
            displayName: serverData.displayName,
            chatToken: serverData.chatToken,
            avatarUrl: serverData.avatarUrl,
            chatConnected: false, // Will be set to true after connection
          });

          // Connect to Stream Chat
          if (!chatConnected) {
            await connectChatUser(
              serverData.username,
              serverData.chatToken,
              serverData.avatarUrl || undefined,
              serverData.displayName || undefined
            );
          }

          setChatConnected(true);
        } else {
          console.log('=== No existing username found ===');
          setChatData({
            username: null,
            chatConnected: false,
          });
        }
      } catch (error) {
        console.error('=== Error initializing chat ===:', error);
        setChatData({
          username: null,
          chatConnected: false,
        });
      }

      setCheckingUsername(false);
    };

    if (isReady && user && !chatConnectAttempted) {
      initializeChat();
    } else if (isReady && !user) {
      // Clear chat data on logout
      clearChatData();
    }
  }, [user, isReady, chatConnectAttempted, setCheckingUsername, setChatConnectAttempted, username, chatToken, getAccessToken, setChatConnected, setChatData, chatConnected, clearChatData]);

  // Clear data when user logs out
  useEffect(() => {
    if (!user) {
      setUsername(null);
      setDisplayName(null); // Add this line
      setChatConnected(false);
      setChatConnectAttempted(false);
    }
  }, [setChatConnectAttempted, setChatConnected, setDisplayName, setUsername, user]);

  // Handle username creation and chat connection
  const handleUsernameSet = async (newUsername: string, newDisplayName: string) => {
    try {
      // The API call will handle storing on server
      // Just update the store after successful creation
      setChatData({
        username: newUsername,
        displayName: newDisplayName,
        chatConnected: true, // Assume connection succeeds
      });
    } catch (error) {
      console.error('Error setting up chat:', error);
      Alert.alert("Error", "Failed to set up chat. Please try again.");
    }
  };

  // Process URL params for deep linking (moved before pending deep link processing)
  useEffect(() => {
    if (params && typeof params.to === "string" && !deepLinkProcessed) {
      console.log('Processing deep link params:', params);

      const parsedParams = {
        to: params.to,
        amount: typeof params.amount === "string" ? params.amount : null,
        token: typeof params.token === "string" ? params.token : "SOL",
        memo: typeof params.memo === "string" ? params.memo : null,
      };

      setPendingDeepLinkParams(parsedParams);
      setDeepLinkProcessed(true);

      // Clear the params from the URL
      router.replace("/");
    }
  }, [params, deepLinkProcessed]);

  // Process pending deep link params after all auth conditions are met
  useEffect(() => {
    console.log('Checking if ready to process pending deep link:', {
      pendingDeepLinkParams: !!pendingDeepLinkParams,
      user: !!user,
      alreadyDelegated,
      biometricAuthenticated,
      username: !!username,
      chatConnected
    });

    if (
      pendingDeepLinkParams &&
      typeof pendingDeepLinkParams.to === "string" &&
      user &&
      alreadyDelegated &&
      biometricAuthenticated &&
      username &&
      chatConnected
    ) {
      console.log('All conditions met, processing pending deep link params:', pendingDeepLinkParams);

      // Build human readable string
      let human = `Send `;
      human += pendingDeepLinkParams.amount ? `${pendingDeepLinkParams.amount} ` : "";
      human += `${pendingDeepLinkParams.token} to ${pendingDeepLinkParams.to}`;
      if (pendingDeepLinkParams.memo) {
        human += ` with a memo of '${pendingDeepLinkParams.memo}'`;
      }

      setPaymentRequest({
        id: Date.now().toString(),
        ...pendingDeepLinkParams,
        human,
      } as PaymentRequest);
      setShowPaymentModal(true);

      // Clear the pending params
      setPendingDeepLinkParams(null);
    }
  }, [pendingDeepLinkParams, user, alreadyDelegated, biometricAuthenticated, username, chatConnected]);

  // Keyboard handling for input box
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardOffset(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardOffset(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Internet connectivity detection
  useEffect(() => {
    let mounted = true;
    const checkConnection = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) {
          setIsConnected(state.isConnected === true ? true : false);
        }
      } catch {
        if (mounted) setIsConnected(false);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const sendTextMessage = useCallback(
    (message: string) => {
      console.log('Sending text message:', message);
      if (!message.trim() || processing || !wsRef.current || wsRef.current.readyState !== 1) return;
      setProcessing(true);
      setProcessed(false);
      setWsStreaming(false);
      setTextInputValue("");
      try {
        wsRef.current.send(JSON.stringify({ message }));
      } catch (e) {
        console.error('Error sending message:', e);
        setProcessing(false);
        setProcessed(true);
        setError("Failed to send message.");
        setHasError(true);
      }
    },
    [processing]
  );

  // Biometric authentication on app resume and login
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && !isAppActive && user) {
        setRequiresBiometric(true);
        setBiometricAuthenticated(false);
      }
      setIsAppActive(nextAppState === 'active');
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [isAppActive, user]);

  // Update the initial biometric auth effect:
  useEffect(() => {
    const performInitialBiometricAuth = async () => {
      if (user && !biometricAuthenticated && !requiresBiometric && !biometricCheckedThisSession) {
        setBiometricCheckedThisSession(true);
        const isAvailable = await BiometricService.isAvailable();
        if (isAvailable) {
          setRequiresBiometric(true);
        } else {
          setBiometricAuthenticated(true);
        }
      }
    };

    performInitialBiometricAuth();
  }, [user, biometricAuthenticated, requiresBiometric, biometricCheckedThisSession]);

  // Register push token when user is authenticated and has wallet
  useEffect(() => {
    const registerPushNotifications = async () => {
      if (user && walletAddress && biometricAuthenticated) {
        try {
          const success = await PushNotificationService.registerPushToken(walletAddress, getAccessToken);
          if (success) {
            console.log('Push notifications registered for wallet:', walletAddress);
          }
        } catch (error) {
          console.error('Failed to register push notifications:', error);
        }
      }
    };

    registerPushNotifications();
  }, [user, walletAddress, biometricAuthenticated, getAccessToken]);

  // Add cleanup effect for logout
  useEffect(() => {
    const unregisterOnLogout = async () => {
      if (!user && walletAddress) {
        try {
          console.log('User logged out, push token will be cleaned up automatically');
        } catch (error) {
          console.error('Error during logout cleanup:', error);
        }
      }
    };

    unregisterOnLogout();
  }, [user, walletAddress]);

  // Reset the session check when user logs out
  useEffect(() => {
    if (!user) {
      setBiometricCheckedThisSession(false);
      setBiometricAuthenticated(false);
      setRequiresBiometric(false);
    }
  }, [user]);

  const handleBiometricAuth = async () => {
    const success = await BiometricService.authenticate("Authenticate to access Solana Agent");
    if (success) {
      setBiometricAuthenticated(true);
      setRequiresBiometric(false);
    }
  };

  // Payment confirmation handlers
  const handleAcceptPayment = async () => {
    if (!paymentRequest?.id) {
      console.error('No payment request ID');
      return;
    }

    setLoadingPaymentRequest(true);

    try {
      const jwt = await getAccessToken();
      if (!jwt) {
        throw new Error('No access token available');
      }

      const response = await fetch(`${API_URL}/payment/request/${paymentRequest.id}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to accept payment request');
      }

      const result = await response.json();
      console.log('Payment request accepted:', result);

      Alert.alert('Success', 'Payment request accepted! The payment will be processed.');

      setShowPaymentModal(false);
      setPaymentRequest(null);

    } catch (error) {
      console.error('Error accepting payment request:', error);
      Alert.alert('Error', `Failed to accept payment request: ${error}`);
    } finally {
      setLoadingPaymentRequest(false);
    }
  };

  const handleDenyPayment = async () => {
    if (!paymentRequest?.id) {
      console.error('No payment request ID');
      return;
    }

    // Show confirmation dialog first
    Alert.alert(
      'Deny Payment Request',
      'Are you sure you want to deny this payment request?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            setLoadingPaymentRequest(true);

            try {
              const jwt = await getAccessToken();
              if (!jwt) {
                throw new Error('No access token available');
              }

              const response = await fetch(`${API_URL}/payment/request/${paymentRequest.id}/deny`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${jwt}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to deny payment request');
              }

              const result = await response.json();
              console.log('Payment request denied:', result);

              Alert.alert('Payment Denied', 'The payment request has been denied.');

              setShowPaymentModal(false);
              setPaymentRequest(null);

            } catch (error) {
              console.error('Error denying payment request:', error);
              Alert.alert('Error', `Failed to deny payment request: ${error}`);
            } finally {
              setLoadingPaymentRequest(false);
            }
          }
        }
      ]
    );
  };

  const handleCancelPayment = () => {
    setShowPaymentModal(false);
    setPaymentRequest(null);
  };

  // Update NFC handling
  useEffect(() => {
    // Only handle NFC if user is authenticated, delegated, biometric auth passed, and chat connected
    if (!user || !alreadyDelegated || !biometricAuthenticated || !username || !chatConnected) return;

    const handlePaymentRequest = async (source: string, payload: string) => {
      console.log(`${source} payment request:`, payload);

      if (payload.startsWith("agent://pay/") || payload.startsWith("https://sol-pay.co/pay/")) {
        const parsed = parseAgentTransferUri(payload, username);
        if (parsed.valid && parsed.paymentId) {
          setLoadingPaymentRequest(true);

          try {
            const paymentData = await fetchPaymentRequest(parsed.paymentId, getAccessToken);

            if (paymentData) {
              // Check if this is a request TO the current user (they need to pay)
              const isPayerRequest = paymentData.payee.toLowerCase() === username.toLowerCase();

              if (isPayerRequest && paymentData.status === 'outstanding') {
                setPaymentRequest({
                  ...paymentData,
                  to: paymentData.payer, // They're paying TO the payer (request creator)
                  human: `Pay ${paymentData.amount} ${paymentData.currency} to ${paymentData.payer}`,
                } as PaymentRequest);
                setShowPaymentModal(true);
              } else if (!isPayerRequest) {
                setError("This payment request is not for you.");
                setHasError(true);
              } else {
                setError(`This payment request is ${paymentData.status}.`);
                setHasError(true);
              }
            } else {
              setError("Payment request not found or expired.");
              setHasError(true);
            }
          } catch (error) {
            console.error('Error loading payment request:', error);
            setError("Failed to load payment request.");
            setHasError(true);
          } finally {
            setLoadingPaymentRequest(false);
          }
        } else {
          setError(parsed.human);
          setHasError(true);
        }
      }
    };

    let cancelled = false;

    const startNfc = async () => {
      try {
        const isSupported = await NfcManager.isSupported();
        if (!isSupported) {
          console.log('NFC not supported');
          return;
        }

        await NfcManager.start();
        console.log('NFC Manager started');

        const onTagDiscovered = async (tag: any) => {
          if (cancelled) return;

          console.log('NFC Tag discovered:', tag);

          if (tag && tag.ndefMessage && tag.ndefMessage.length > 0) {
            try {
              const ndefRecord = tag.ndefMessage[0];
              const payload = Ndef.text.decodePayload(ndefRecord.payload as unknown as Uint8Array);
              console.log('NFC Payload:', payload);

              await handlePaymentRequest('NFC', payload);
            } catch (error) {
              console.error('Error processing NFC tag:', error);
            }
          }

          // **Key for multi-scan:** Clean up and re-register for next scan
          try {
            await NfcManager.setAlertMessageIOS('Ready to scan again');
            await NfcManager.invalidateSessionWithErrorIOS(''); // iOS: end session
          } catch { }
          try {
            await NfcManager.cancelTechnologyRequest(); // Android: clear tag
          } catch { }

          // Remove listener and re-register for next scan
          NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
          setTimeout(() => {
            if (!cancelled) {
              registerForTags();
            }
          }, 1000);
        };

        const registerForTags = async () => {
          if (cancelled) return;

          try {
            NfcManager.setEventListener(NfcEvents.DiscoverTag, onTagDiscovered);
            await NfcManager.registerTagEvent({
              alertMessage: "Ready to scan NFC tags",
              invalidateAfterFirstRead: false,
            });
            console.log('NFC tag event registered');
          } catch (error) {
            console.error('Error registering NFC tag event:', error);
            setTimeout(() => {
              if (!cancelled) {
                registerForTags();
              }
            }, 2000);
          }
        };

        await registerForTags();

      } catch (error) {
        console.error('Error starting NFC:', error);
      }
    };

    startNfc();

    return () => {
      cancelled = true;
      console.log('Cleaning up NFC...');
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      NfcManager.unregisterTagEvent().catch((error) => {
        console.log('Error unregistering NFC:', error);
      });
    };
  }, [user, alreadyDelegated, biometricAuthenticated, username, chatConnected, getAccessToken]);

  // WebSocket connection and auto-reconnect
  useEffect(() => {
    if (!user?.id || !isReady || !alreadyDelegated || !isConnected || !username || !chatConnected) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      return;
    }

    let ws: WebSocket | null = null;
    let shouldReconnect = true;

    const connect = async () => {
      if (!user?.id || !isReady || !alreadyDelegated || !isConnected || !username || !chatConnected) return;
      const jwt = await getAccessToken();
      if (!jwt) {
        setError("Failed to get access token for WebSocket.");
        setHasError(true);
        return;
      }
      ws = new WebSocket(`${WS_URL}?token=${jwt}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setError("");
        setHasError(false);
      };

      ws.onmessage = (event) => {
        try {
          JSON.parse(event.data as string);
          setProcessing(false);
          setProcessed(true);
          setWsStreaming(true);
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
          setProcessing(false);
          setProcessed(true);
        }
      };

      ws.onerror = () => {
        if (isConnected) {
          setError("WebSocket error. Trying to reconnect...");
          setHasError(true);
        }
        setProcessing(false);
        ws?.close();
      };

      ws.onclose = () => {
        setProcessing(false);
        setWsStreaming(false);
        wsRef.current = null;
        if (shouldReconnect && isConnected && user?.id && isReady && alreadyDelegated && username && chatConnected) {
          setError("WebSocket disconnected. Reconnecting...");
          setHasError(true);
          if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = setTimeout(connect, 2000);
        } else {
          if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user?.id, isReady, getAccessToken, alreadyDelegated, isConnected, username, chatConnected]);

  // Update Payment Confirmation Modal to show all payment request details
  const PaymentConfirmationModal = () => {
    const request = paymentRequest as any;

    return (
      <Portal>
        <Modal
          visible={showPaymentModal}
          onDismiss={handleCancelPayment}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Request</Text>
            </View>

            {/* Content - same as before */}
            <View style={styles.modalBody}>
              {/* Amount Section */}
              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>Amount</Text>
                <View style={styles.amountContainer}>
                  <Text style={styles.amountValue}>
                    {currencySymbol(request?.currency) || "$"}
                    {request?.amount || "Not specified"}
                  </Text>
                </View>
                {request?.currency && (
                  <Text style={styles.currencyText}>
                    {currencyName(request.currency)}
                  </Text>
                )}
              </View>

              {/* Requesting User Section */}
              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>Requesting Payment</Text>
                <Text style={styles.addressText}>
                  {request?.to || request?.payer}
                </Text>
              </View>

              {/* Due Date Section */}
              {request?.dueDate && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Due Date</Text>
                  <Text style={styles.memoText}>
                    {new Date(request.dueDate * 1000).toLocaleDateString()}
                  </Text>
                </View>
              )}

              {/* External ID Section */}
              {request?.externalId && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Reference ID</Text>
                  <Text style={styles.memoText}>
                    {request.externalId}
                  </Text>
                </View>
              )}

              {/* Memo Section */}
              {request?.memo && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Memo</Text>
                  <Text style={styles.memoText}>
                    {request.memo}
                  </Text>
                </View>
              )}

              {/* Attachments Section */}
              {request?.attachments && request.attachments.length > 0 && (
                <View style={styles.infoSection}>
                  <Text style={styles.infoLabel}>Attachments</Text>
                  <ScrollView style={{ maxHeight: 120 }}>
                    {request.attachments.map((attachment: any, index: number) => (
                      <TouchableOpacity
                        key={attachment.id || index}
                        style={styles.attachmentItem}
                        onPress={() => {
                          Linking.openURL(attachment.url).catch(err => {
                            console.error('Failed to open attachment:', err);
                          });
                        }}
                      >
                        <Icon name="file-pdf-box" size={16} color="#3b82f6" />
                        <Text style={styles.attachmentText}>
                          {attachment.filename}
                        </Text>
                        <Text style={styles.attachmentSize}>
                          ({(attachment.size / (1024 * 1024)).toFixed(1)} MB)
                        </Text>
                        <Icon name="external-link" size={14} color="#a1a1aa" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* You will pay section */}
              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>You will pay</Text>
                <Text style={styles.payAmountText}>
                  ≈ {request?.amount || "..."} {request?.token || "USDC"}
                </Text>
              </View>
            </View>

            {/* Updated Footer Buttons - Accept/Deny instead of Pay Now */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleAcceptPayment}
                disabled={loadingPaymentRequest}
              >
                {loadingPaymentRequest ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Accept & Pay</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.denyButton}
                onPress={handleDenyPayment}
                disabled={loadingPaymentRequest}
              >
                <Text style={styles.denyButtonText}>Deny</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelPayment}
                disabled={loadingPaymentRequest}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Portal>
    );
  };

  // Add loading overlay for payment request fetching
  const PaymentLoadingOverlay = () => (
    loadingPaymentRequest ? (
      <View style={styles.spinnerOverlay}>
        <ActivityIndicator size="large" color="#fff" />
        <RNText style={{ color: "#fff", paddingTop: 10 }}>
          Loading payment request...
        </RNText>
      </View>
    ) : null
  );

  // Biometric authentication screen
  const BiometricAuthScreen = () => (
    <PaperProvider>
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: DARK_BG }}>
        <Card style={{ width: 340, margin: 16, alignItems: "center", backgroundColor: "#27272a" }}>
          <Card.Title title="Authentication Required" titleStyle={{ color: "#fff" }} />
          <Card.Content>
            <Text style={{ marginBottom: 20, textAlign: "center", color: "#fff" }}>
              Please authenticate to access your wallet
            </Text>
            <Button
              mode="contained"
              onPress={handleBiometricAuth}
              style={{ backgroundColor: PURPLE_800, width: 200, marginBottom: 10 }}
              labelStyle={{ color: "#fff" }}
              icon="fingerprint"
            >
              Authenticate
            </Button>
          </Card.Content>
        </Card>
      </SafeAreaView>
    </PaperProvider>
  );

  // --- PRIORITY: Show ONLY this if offline (isConnected is false OR null) ---
  if (isConnected === false || isConnected === null) {
    return (
      <PaperProvider>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: DARK_BG }}>
          <Card style={{ width: 340, margin: 16, alignItems: "center", backgroundColor: "#27272a" }}>
            <Card.Title title="No Internet Connection" titleStyle={{ color: "#fff" }} />
            <Card.Content>
              <Text style={{ color: "#f87171", fontSize: 16, textAlign: "center", marginBottom: 12 }}>
                You must be connected to the Internet to use Solana Agent.
              </Text>
              <Text style={{ color: "#fff", fontSize: 14, textAlign: "center" }}>
                Please check your connection and try again.
              </Text>
            </Card.Content>
          </Card>
        </SafeAreaView>
      </PaperProvider>
    );
  }

  // Biometric authentication required
  if (isReady && user && alreadyDelegated && requiresBiometric && !biometricAuthenticated) {
    return <BiometricAuthScreen />;
  }

  // Privy loading state
  if (!isReady || checkingUsername) {
    return (
      <PaperProvider>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_BG }}>
          <ActivityIndicator size="large" color="#fff" />
          <RNText style={{ color: '#fff', marginTop: 10 }}>Loading...</RNText>
        </SafeAreaView>
      </PaperProvider>
    );
  }

  // Not authenticated: use Privy UI login
  if (isReady && !user) {
    return (
      <PaperProvider>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: DARK_BG }}>
          <Button
            mode="contained"
            onPress={() =>
              login({ loginMethods: ["email"] })
            }
            style={styles.loginButton}
            labelStyle={styles.loginLabel}
            contentStyle={styles.loginContent}
          >
            Login
          </Button>
        </SafeAreaView>
      </PaperProvider>
    );
  }

  // Authenticated but not delegated
  if (isReady && user && !alreadyDelegated) {
    // If no wallet, show create wallet UI and let user trigger creation
    if (!wallet?.wallets || wallet.wallets.length === 0 || !wallet.wallets[0].address) {
      return (
        <PaperProvider>
          <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: DARK_BG }}>
            <Card style={{ width: 320, margin: 16, alignItems: "center", backgroundColor: "#27272a" }}>
              <Card.Title title="Create Wallet" titleStyle={{ color: "#fff" }} />
              <Card.Content>
                <Text style={{ marginBottom: 20, textAlign: "center", color: "#fff" }}>
                  Create your embedded Solana wallet
                </Text>
                <Button
                  mode="contained"
                  onPress={async () => {
                    setWalletCreating(true);
                    setWalletCreateError(null);
                    try {
                      if (create) {
                        await create();
                      } else {
                        setWalletCreateError(
                          "Wallet creation function is not available."
                        )
                      }
                    } catch (err: any) {
                      setWalletCreateError(
                        err?.message || "Failed to create wallet. Please try again."
                      );
                    } finally {
                      setWalletCreating(false);
                    }
                  }}
                  loading={walletCreating}
                  disabled={walletCreating}
                  style={{ backgroundColor: PURPLE_800, width: 200, marginBottom: 10 }}
                  labelStyle={{ color: "#fff" }}
                >
                  {walletCreating ? "Creating Wallet..." : "Create Wallet"}
                </Button>
                {walletCreateError && (
                  <Text style={styles.error}>{walletCreateError}</Text>
                )}
              </Card.Content>
            </Card>
          </SafeAreaView>
        </PaperProvider>
      );
    }

    // Use the new DelegateWalletButton
    return (
      <PaperProvider>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: DARK_BG }}>
          <Card style={{ width: 340, margin: 16, alignItems: "center", backgroundColor: "#27272a" }}>
            <Card.Title title="Delegate Access" titleStyle={{ color: "#fff" }} />
            <Card.Content>
              <Text style={{ marginBottom: 20, textAlign: "center", color: "#fff" }}>
                Delegate your embedded wallet to the agent
              </Text>
              <DelegateWalletButton
                user={user}
                wallet={wallet}
                onDelegated={() => {
                  // This callback might need to trigger a re-check or state update
                }}
              />
            </Card.Content>
          </Card>
        </SafeAreaView>
      </PaperProvider>
    );
  }

  // NEW: Authenticated, delegated, biometrics passed, but no username
  if (isReady && user && alreadyDelegated && biometricAuthenticated && !username) {
    return (
      <PaperProvider>
        <UsernameSetup
          onUsernameSet={handleUsernameSet}
          getAccessToken={getAccessToken}
        />
      </PaperProvider>
    );
  }

  // Authenticated, delegated, biometrics passed, has username but chat not connected
  if (isReady && user && alreadyDelegated && biometricAuthenticated && username && !chatConnected) {
    return (
      <PaperProvider>
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DARK_BG }}>
          <ActivityIndicator size="large" color="#fff" />
          <RNText style={{ color: '#fff', marginTop: 10 }}>Connecting to chat...</RNText>
        </SafeAreaView>
      </PaperProvider>
    );
  }

  // Authenticated, delegated, biometrics passed, username set, and chat connected
  if (isReady && user && alreadyDelegated && biometricAuthenticated && username && chatConnected) {
    return (
      <PaperProvider>
        <Appbar.Header style={styles.header}>
          <Appbar.Content title="Agent" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <PaymentConfirmationModal />
        <PaymentLoadingOverlay />
        <KeyboardAvoidingView
          style={[styles.container, { paddingBottom: keyboardOffset }]}
          behavior={"height"}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: DARK_BG }}>
            <View style={{ flex: 1 }}>
              {user?.id && (
                <InfiniteScrollChat
                  userId={user.id}
                  getAccessToken={getAccessToken}
                  processed={processed}
                  deleted={deleting}
                  accountLinked={accountLinked}
                  wsStreaming={wsStreaming}
                  onScrollToBottom={() => { }}
                />
              )}

              {processing && !hasError && (
                <View style={styles.spinnerOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <RNText style={{ color: "#fff", paddingTop: 10 }}>
                    Sending message...
                  </RNText>
                </View>
              )}
              {hasError && !processing && (
                <View style={{ position: 'absolute', top: '30%', left: 20, right: 20, alignItems: 'center', zIndex: 10 }}>
                  <Card style={{ alignSelf: 'stretch', backgroundColor: "#27272a" }}>
                    <Card.Content>
                      <Text style={styles.error}>{error}</Text>
                      <Button onPress={() => { setHasError(false); setError(""); }} mode="outlined" style={{ marginTop: 10, borderColor: "#fff" }} labelStyle={{ color: "#fff" }}>
                        Dismiss
                      </Button>
                    </Card.Content>
                  </Card>
                </View>
              )}
            </View>

            <View style={[styles.inputContainer, { marginBottom: keyboardOffset }]}>
              <TextInput
                style={styles.textInput}
                placeholder="Command Agent..."
                value={textInputValue}
                onChangeText={setTextInputValue}
                onSubmitEditing={() => sendTextMessage(textInputValue)}
                editable={!processing && isConnected === true}
                placeholderTextColor="#a3a3a3"
                blurOnSubmit={false}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (processing || !textInputValue.trim() || isConnected !== true) && styles.sendButtonDisabled,
                ]}
                onPress={() => sendTextMessage(textInputValue)}
                disabled={processing || !textInputValue.trim() || isConnected !== true}
              >
                <Icon name="send" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </PaperProvider>
    );
  }

  // fallback
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  card: { marginVertical: 10, marginHorizontal: 16 },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: "#27272a",
    backgroundColor: DARK_BG,
  },
  loginButton: {
    backgroundColor: "#6d28d9",
    width: 220,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 24,
  },
  loginLabel: {
    color: "#fff",
    fontSize: 22,
    padding: 8,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  loginContent: {
    height: 64,
  },
  textInput: {
    flex: 1,
    marginRight: 8,
    borderRadius: 20,
    paddingHorizontal: 12,
    backgroundColor: "#27272a",
    color: "#fff",
    height: 54,
    fontSize: 18,
  },
  sendButton: {
    borderRadius: 24,
    width: 54,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BLUE_400,
  },
  sendButtonDisabled: {
    backgroundColor: "#52525b",
  },
  error: { color: "#f87171", alignSelf: "center", fontSize: 14, margin: 10 },
  spinnerOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: DARK_OVERLAY,
    zIndex: 100,
  },
  flatListContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  youCard: {
    backgroundColor: BLUE_400,
    borderRadius: 12,
  },
  agentCard: {
    backgroundColor: PURPLE_800,
    borderRadius: 12,
  },
  youText: {
    color: "#fff",
    fontSize: 16,
  },
  agentText: {
    color: "#fff",
    fontSize: 16,
  },
  modalContainer: {
    margin: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: "#1f2937", // gray-800
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#374151", // gray-700
  },
  modalHeader: {
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  modalBody: {
    marginBottom: 24,
  },
  infoSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#d1d5db', // gray-300
    marginBottom: 8,
    textAlign: 'center',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  tokenText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 4,
  },
  addressText: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  memoText: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  payAmountText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'column',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#3b82f6', // blue-500
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#374151', // gray-700
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  attachmentText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  attachmentSize: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  denyButton: {
    flex: 1,
    backgroundColor: '#ef4444', // red-500
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  denyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: "#18181b",
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#3f3f46",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
