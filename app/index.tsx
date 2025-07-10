import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  TextInput,
  TouchableOpacity,
  Text as RNText,
  ActivityIndicator,
  SafeAreaView,
  FlatList,
  Keyboard,
  Linking,
  AppState,
  Alert,
} from "react-native";
import * as Network from "expo-network";
import Hyperlink from "react-native-hyperlink";
import { useAppStore } from "../components/Store";
import {
  usePrivy,
  useEmbeddedSolanaWallet,
  PrivyUser,
} from "@privy-io/expo";
import { useLogin, useDelegatedActions } from "@privy-io/expo/ui";
import {
  Provider as PaperProvider,
  Button,
  Card,
  Text,
  Modal,
  Portal,
} from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import NfcManager, { NfcTech, Ndef, NfcEvents } from "react-native-nfc-manager";
import { BiometricService } from "../components/BiometricService";
import { PushNotificationService } from '../components/PushNotificationService';
import { useLocalSearchParams, router } from 'expo-router';
import { UsernameSetup } from "../components/UsernameSetup";
import { 
  getStoredUsername, 
  getStoredChatToken,
  storeUsername, 
  storeChatToken,
  clearStoredData, 
  connectChatUser,
  fetchExistingUserData 
} from "../config/chatConfig";

const API_URL = "https://api.sol-pay.co";
const WS_URL = "wss://api.sol-pay.co/ws/chat";

// Tailwind colors
const PURPLE_800 = "#6d28d9";
const BLUE_400 = "#60a5fa";
const DARK_BG = "#18181b";
const DARK_OVERLAY = "rgba(24,24,27,0.85)";

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
});

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

type PaymentRequest = {
  id: string;
  amount: string | null;
  to: string;
  token: string | null;
  memo: string | null;
  human: string;
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
      } catch (err) {
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
                  } catch {}
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
      ListFooterComponent={fetchLoading ? <ActivityIndicator color="#fff" /> : null}
      inverted
    />
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

// --- Agent transfer URI parser for amount, to, token, memo ---
function parseAgentTransferUri(uri: string): {
  amount: string | null;
  to: string;
  token: string | null;
  memo: string | null;
  human: string;
  valid: boolean;
} {
  try {
    console.log('Parsing URI:', uri);
    
    let amount: string | null = null;
    let to: string = "";
    let token: string | null = null;
    let memo: string | null = null;

    // Handle Universal Links
    if (uri.startsWith("https://sol-pay.co/pay")) {
      try {
        const url = new URL(uri);
        amount = url.searchParams.get("amount");
        to = url.searchParams.get("to") || "";
        token = url.searchParams.get("token") || "SOL";
        memo = url.searchParams.get("memo");
        
        console.log('Universal Link - Parsed params:', { amount, to, token, memo });
      } catch (error) {
        console.error('Error parsing Universal Link:', error);
        return {
          amount: null,
          to: "",
          token: null,
          memo: null,
          human: "Invalid Universal Link format",
          valid: false,
        };
      }
    }
    // Handle custom scheme: agent://pay?...
    else if (uri.startsWith("agent://pay")) {
      const withoutScheme = uri.replace("agent://", "");
      const [command, queryString] = withoutScheme.split("?");
      
      console.log('Custom scheme - Command:', command, 'Query:', queryString);
      
      if (command !== "pay") {
        return {
          amount: null,
          to: "",
          token: null,
          memo: null,
          human: "Invalid URI: only pay command is supported",
          valid: false,
        };
      }

      const params = new URLSearchParams(queryString || "");
      amount = params.get("amount");
      to = params.get("to") || "";
      token = params.get("token") || "SOL";
      memo = params.get("memo");
      
      console.log('Custom scheme - Parsed params:', { amount, to, token, memo });
    }
    else {
      return {
        amount: null,
        to: "",
        token: null,
        memo: null,
        human: "Invalid URI: must use https://sol-pay.co/pay or agent:// scheme",
        valid: false,
      };
    }

    if (!to) {
      return {
        amount: null,
        to: "",
        token: null,
        memo: null,
        human: "Invalid URI: 'to' parameter is required",
        valid: false,
      };
    }

    // Validate recipient: must be either a Solana address (base58, 32-44 chars) or SNS name (*.sol)
    const base58re = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const snsNameRe = /^[a-zA-Z0-9_-]+\.sol$/;
    if (!base58re.test(to) && !snsNameRe.test(to)) {
      return {
        amount: null,
        to: "",
        token: null,
        memo: null,
        human: "Invalid recipient: must be a Solana address or SNS name (*.sol)",
        valid: false,
      };
    }

    // Build human readable string
    let human = `Send `;
    human += amount ? `${amount} ` : "";
    human += `${token} to ${to}`;
    if (memo) {
      human += ` with a memo of '${memo}'`;
    }

    console.log('Generated human command:', human);

    return {
      amount,
      to,
      token,
      memo,
      human,
      valid: true,
    };
  } catch (error) {
    console.error('Error parsing URI:', error);
    return {
      amount: null,
      to: "",
      token: null,
      memo: null,
      human: "Invalid Pay URI",
      valid: false,
    };
  }
}

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

  // Username and chat connection state
  const [username, setUsername] = useState<string | null>(null);
  const [chatConnected, setChatConnected] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(true);

  // Biometric authentication state
  const [isAppActive, setIsAppActive] = useState(true);
  const [requiresBiometric, setRequiresBiometric] = useState(false);
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);
  const [biometricCheckedThisSession, setBiometricCheckedThisSession] = useState(false);

  // Deep link handling - separate from pending NFC
  const [pendingDeepLinkParams, setPendingDeepLinkParams] = useState<any>(null);
  const [deepLinkProcessed, setDeepLinkProcessed] = useState(false);

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

  // Check for stored username and connect to chat
  useEffect(() => {
    const initializeChat = async () => {
      if (user) {
        try {
          // First, check locally stored data
          const storedUsername = await getStoredUsername();
          const storedToken = await getStoredChatToken();
          
          if (storedUsername && storedToken) {
            // Try to reconnect to chat with stored data
            try {
              await connectChatUser(storedUsername, storedToken);
              setUsername(storedUsername);
              setChatConnected(true);
              setCheckingUsername(false);
              return;
            } catch (error) {
              console.error('Failed to reconnect with stored data:', error);
              // Clear invalid stored data and continue to server check
              await clearStoredData();
            }
          }

          // If no valid local data, check server for existing username
          console.log('Checking server for existing username...');
          const serverData = await fetchExistingUserData(getAccessToken);
          
          if (serverData.username && serverData.chatToken) {
            console.log('Found existing username on server:', serverData.username);
            
            // Store the data locally
            await storeUsername(serverData.username);
            await storeChatToken(serverData.chatToken);
            
            // Connect to chat
            await connectChatUser(serverData.username, serverData.chatToken);
            setUsername(serverData.username);
            setChatConnected(true);
          } else {
            console.log('No existing username found on server');
            // User needs to create a username
            setUsername(null);
            setChatConnected(false);
          }
        } catch (error) {
          console.error('Error initializing chat:', error);
        }
      }
      setCheckingUsername(false);
    };

    initializeChat();
  }, [user, getAccessToken]);

  // Clear data when user logs out
  useEffect(() => {
    if (!user) {
      setUsername(null);
      setChatConnected(false);
      clearStoredData();
    }
  }, [user]);

  // Handle username creation and chat connection
  const handleUsernameSet = async (newUsername: string) => {
    try {
      // Store username first
      await storeUsername(newUsername);
      
      // Get the chat token from your API
      const accessToken = await getAccessToken();
      
      const response = await fetch(`${API_URL}/chat/get-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          username: newUsername,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get chat token');
      }

      const { chatToken } = await response.json();
      
      // Store token
      await storeChatToken(chatToken);
      
      // Connect to Stream Chat
      await connectChatUser(newUsername, chatToken);
      
      setUsername(newUsername);
      setChatConnected(true);
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
  }, [params, deepLinkProcessed, router]);

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
      });
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
  const handleConfirmPayment = () => {
    console.log('Confirm button pressed', { paymentRequest });
    
    if (paymentRequest) {
      // Build the complete command including memo if present
      let command = `Send `;
      command += paymentRequest.amount ? `${paymentRequest.amount} ` : "";
      command += `${paymentRequest.token || "SOL"} to ${paymentRequest.to}`;
      if (paymentRequest.memo) {
        command += ` with a memo of '${paymentRequest.memo}'`;
      }
      
      console.log('Sending command:', command);
      sendTextMessage(command);
      setShowPaymentModal(false);
      setPaymentRequest(null);
    } else {
      console.log('No payment request found');
    }
  };

  const handleCancelPayment = () => {
    setShowPaymentModal(false);
    setPaymentRequest(null);
  };

  // Common function to handle payment requests from both NFC and deep links
  const handlePaymentRequest = (source: string, payload: string) => {
    console.log(`${source} payment request:`, payload);

    if (payload.startsWith("agent://pay") || payload.startsWith("https://wallet.solana-agent.com/pay") || payload.startsWith("https://sol-pay.co/pay")) {
      const parsed = parseAgentTransferUri(payload);
      if (parsed.valid) {
        setPaymentRequest(null);
        setShowPaymentModal(false);

        setTimeout(() => {
          setPaymentRequest({
            id: Date.now().toString(),
            amount: parsed.amount,
            to: parsed.to,
            token: parsed.token,
            memo: parsed.memo,
            human: parsed.human,
          });
          setShowPaymentModal(true);
        }, 100);
      } else {
        setError(parsed.human);
        setHasError(true);
      }
    }
  };

  // NFC handling
  useEffect(() => {
    // Only handle NFC if user is authenticated, delegated, biometric auth passed, and chat connected
    if (!user || !alreadyDelegated || !biometricAuthenticated || !username || !chatConnected) return;

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

              handlePaymentRequest('NFC', payload);
            } catch (error) {
              console.error('Error processing NFC tag:', error);
            }
          }

          // **Key for multi-scan:** Clean up and re-register for next scan
          try {
            await NfcManager.setAlertMessageIOS('Ready to scan again');
            await NfcManager.invalidateSessionWithErrorIOS(''); // iOS: end session
          } catch {}
          try {
            await NfcManager.cancelTechnologyRequest(); // Android: clear tag
          } catch {}

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
  }, [user, alreadyDelegated, biometricAuthenticated, username, chatConnected]);

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

  // Payment Confirmation Modal
  const PaymentConfirmationModal = () => {
    console.log('PaymentConfirmationModal render:', {
      showPaymentModal,
      paymentRequest
    });
    
    return (
      <Portal>
        <Modal
          visible={showPaymentModal}
          onDismiss={handleCancelPayment}
          contentContainerStyle={{
            backgroundColor: "#27272a",
            margin: 20,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <Card style={{ backgroundColor: "#27272a" }} key={paymentRequest?.id || Date.now()}>
            <Card.Title 
              title="Confirm Payment" 
              titleStyle={{ color: "#fff", fontSize: 20, fontWeight: "bold" }} 
            />
            <Card.Content>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: "#a3a3a3", fontSize: 14, marginBottom: 4 }}>
                  Amount
                </Text>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
                  {paymentRequest?.amount || "Not specified"} {paymentRequest?.token || "SOL"}
                </Text>
              </View>

              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: "#a3a3a3", fontSize: 14, marginBottom: 4 }}>
                  To
                </Text>
                <Text style={{ color: "#fff", fontSize: 16, fontFamily: "monospace" }}>
                  {paymentRequest?.to}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <Button
                  mode="outlined"
                  onPress={handleCancelPayment}
                  style={{ 
                    flex: 1, 
                    borderColor: "#52525b",
                  }}
                  labelStyle={{ color: "#fff" }}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleConfirmPayment}
                  style={{ 
                    flex: 1, 
                    backgroundColor: PURPLE_800,
                  }}
                  labelStyle={{ color: "#fff" }}
                >
                  Confirm
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    );
  };

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
        <PaymentConfirmationModal />
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
                  onScrollToBottom={() => {}}
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
