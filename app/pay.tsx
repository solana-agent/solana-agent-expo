import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { Appbar, IconButton } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import Constants from "expo-constants";
import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";

const API_URL = Constants.expoConfig?.extra?.apiUrl;
const DARK_BG = "#18181b";
const CARD_BG = "#23232b";
const ACCENT = "#3b82f6";
const ERROR = "#ef4444";
const BORDER = "#27272a";

type PaymentRequest = {
  id: string;
  amount: number;
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
  human?: string;
  to?: string;
  total_amount: number;
  fee_percent: number;
  fee_total: number;
};

export default function PayScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPaymentRequest, setLoadingPaymentRequest] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const wallet = useEmbeddedSolanaWallet();
  const [loadingBalance, setLoadingBalance] = useState(false);

  const walletAddress =
    wallet?.wallets && wallet.wallets.length > 0 && wallet.wallets[0]?.address
      ? wallet.wallets[0]?.address
      : null;

  useFocusEffect(
    useCallback(() => {
      setPayment(null);
      setError(null);
      setLoading(true);

      if (!id) {
        setError("No payment ID provided.");
        setLoading(false);
        return;
      }
      const fetchPayment = async () => {
        try {
          const jwt = await getAccessToken();
          if (!jwt) {
            throw new Error('No access token available');
          }

          const res = await fetch(`${API_URL}/payment/request/${id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) throw new Error("Payment not found");
          const data = await res.json();
          setPayment(data.request);

          // Fetch USDC balance
          try {
            const balanceRes = await fetch(`${API_URL}/wallet/balance?wallet_address=${walletAddress}&token=USDC`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${jwt}`,
                'Content-Type': 'application/json',
              },
            });
            if (balanceRes.ok) {
              const balanceData = await balanceRes.json();
              setUsdcBalance(balanceData.balance); // expects { balance: number }
            } else {
              setUsdcBalance(null);
            }
          } catch {
            setUsdcBalance(null);
          }

        } catch (e: any) {
          setError(e.message);
        } finally {
          setLoading(false);
        }
      };
      fetchPayment();
    }, [id, getAccessToken])
  );

  const handleAcceptPayment = async () => {
    if (!payment?.id) return;
    setLoadingPaymentRequest(true);
    try {
      const jwt = await getAccessToken();
      if (!jwt) throw new Error('No access token available');
      const response = await fetch(`${API_URL}/payment/request/${payment.id}/accept`, {
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
      Alert.alert('Success', 'Payment request accepted! The payment will be processed.');
      router.back();
    } catch (error) {
      console.error('Error accepting payment request:', error);
      Alert.alert('Error', `Failed to accept payment request: ${error}`);
    } finally {
      setLoadingPaymentRequest(false);
    }
  };

  const handleDenyPayment = async () => {
    if (!payment?.id) return;
    Alert.alert(
      'Deny Payment Request',
      'Are you sure you want to deny this payment request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            setLoadingPaymentRequest(true);
            try {
              const jwt = await getAccessToken();
              if (!jwt) throw new Error('No access token available');
              const response = await fetch(`${API_URL}/payment/request/${payment.id}/deny`, {
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
              Alert.alert('Payment Denied', 'The payment request has been denied.');
              router.back();
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

  const fetchUsdcBalance = async () => {
    try {
      setLoadingBalance(true);
      const accessToken = await getAccessToken();
      if (!accessToken || !walletAddress) return;
      const response = await fetch(`${API_URL}/wallet/balance?wallet_address=${walletAddress}&token=USDC`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsdcBalance(data.balance);
      } else {
        setUsdcBalance(null);
      }
    } catch (error) {
      setUsdcBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleCancelPayment = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={{ color: "#fff", marginTop: 10, fontSize: 18 }}>Loading payment request...</Text>
      </View>
    );
  }

  if (error || !payment) {
    return (
      <View style={styles.centerContent}>
        <Text style={{ color: ERROR, fontSize: 18 }}>{error || "Payment not found"}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (payment.status === "rejected") {
    return (
      <View style={styles.centerContent}>
        <Icon name="close-circle-outline" size={64} color={ERROR} style={{ marginBottom: 24 }} />
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>Payment Denied</Text>
        <Text style={{ color: "#d1d5db", fontSize: 16, textAlign: "center", marginBottom: 32, paddingHorizontal: 24 }}>
          This payment request has been denied and can no longer be paid.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
        <Appbar.Content title="Payment Request" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {/* Amount */}
          <View style={styles.amountRow}>
            <Icon name="currency-usd" size={32} color={ACCENT} style={{ marginRight: 12 }} />
            <Text style={styles.amountText}>
              {payment.amount !== undefined
                ? `${Number(payment.amount).toFixed(2)} USDC`
                : '--'}
            </Text>
          </View>

          {/* Payee & Payer */}
          <View style={styles.row}>
            <View style={styles.userBox}>
              <Icon name="account-arrow-left" size={22} color={ACCENT} style={{ marginRight: 6 }} />
              <Text style={styles.userLabel}>Payee</Text>
              <Text style={styles.userValue}>{payment.payee}</Text>
            </View>
            <View style={styles.userBox}>
              <Icon name="account-arrow-right" size={22} color={ACCENT} style={{ marginRight: 6 }} />
              <Text style={styles.userLabel}>Payer</Text>
              <Text style={styles.userValue}>{payment.payer}</Text>
            </View>
          </View>

          {/* Due Date & Reference */}
          <View style={styles.row}>
            {payment.dueDate && (
              <View style={styles.infoBox}>
                <Icon name="calendar" size={20} color={ACCENT} style={{ marginRight: 6 }} />
                <Text style={styles.infoLabel}>Due</Text>
                <Text style={styles.infoValue}>{new Date(payment.dueDate * 1000).toLocaleDateString()}</Text>
              </View>
            )}
            {payment.externalId && (
              <View style={styles.infoBox}>
                <Icon name="identifier" size={20} color={ACCENT} style={{ marginRight: 6 }} />
                <Text style={styles.infoLabel}>Reference</Text>
                <Text style={styles.infoValue}>{payment.externalId}</Text>
              </View>
            )}
          </View>

          {/* Memo */}
          {payment.memo && (
            <View style={styles.memoBox}>
              <Icon name="file-document-outline" size={20} color={ACCENT} style={{ marginRight: 6 }} />
              <Text style={styles.memoLabel}>Memo</Text>
              <Text style={styles.memoValue}>{payment.memo}</Text>
            </View>
          )}

          {/* Attachments */}
          {payment.attachments && payment.attachments.length > 0 && (
            <View style={styles.attachmentsBox}>
              <Text style={styles.attachmentsLabel}>Attachments</Text>
              {payment.attachments.map((attachment, index) => (
                <TouchableOpacity
                  key={attachment.id || index}
                  style={styles.attachmentItem}
                  onPress={() => {
                    Linking.openURL(attachment.url).catch(err => {
                      console.error('Failed to open attachment:', err);
                    });
                  }}
                >
                  <Icon name="file-pdf-box" size={20} color={ACCENT} style={{ marginRight: 8 }} />
                  <Text style={styles.attachmentText} numberOfLines={1}>
                    {attachment.filename}
                  </Text>
                  <Text style={styles.attachmentSize}>
                    {attachment.size ? `(${(attachment.size / (1024 * 1024)).toFixed(1)} MB)` : ""}
                  </Text>
                  <Icon name="open-in-new" size={16} color="#a1a1aa" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Fee & Total */}
          <View style={styles.row}>
            <View style={styles.infoBox}>
              <Icon name="percent" size={20} color={ACCENT} style={{ marginRight: 6 }} />
              <Text style={styles.infoLabel}>Fee</Text>
              <Text style={styles.infoValue}>{payment.fee_percent}% ({Number(payment.fee_total).toFixed(2)} USDC)</Text>
            </View>
            <View style={styles.infoBox}>
              <Icon name="cash-check" size={20} color={ACCENT} style={{ marginRight: 6 }} />
              <Text style={styles.infoLabel}>You Pay</Text>
              <Text style={styles.infoValue}>{Number(payment.total_amount).toFixed(2)} USDC</Text>
            </View>
          </View>

          {/* USDC Balance */}
          <View style={styles.balanceBox}>
            <Icon name="wallet" size={22} color={ACCENT} style={{ marginRight: 8 }} />
            <Text style={styles.balanceLabel}>Your USDC Balance</Text>
            <Text style={styles.balanceValue}>
              {usdcBalance !== null
                ? `${Number(usdcBalance).toFixed(2)} USDC`
                : 'Loading...'}
            </Text>
            <IconButton
              icon="refresh"
              iconColor={ACCENT}
              size={22}
              onPress={fetchUsdcBalance}
              style={styles.refreshButton}
            />
          </View>
          {usdcBalance !== null && payment && usdcBalance < payment.total_amount && (
            <Text style={styles.balanceWarning}>
              <Icon name="alert-circle" size={16} color={ERROR} /> Insufficient USDC balance to pay this invoice.
            </Text>
          )}

          {/* Footer Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (loadingPaymentRequest ||
                  (usdcBalance !== null && payment && usdcBalance < payment.total_amount))
                  ? styles.confirmButtonDisabled
                  : null
              ]}
              onPress={handleAcceptPayment}
              disabled={
                loadingPaymentRequest ||
                (usdcBalance !== null && payment && usdcBalance < payment.total_amount)
              }
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: DARK_BG,
  },
  header: {
    backgroundColor: DARK_BG,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 32,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    justifyContent: "center",
  },
  amountText: {
    fontSize: 32,
    fontWeight: "bold",
    color: ACCENT,
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 12,
  },
  userBox: {
    flex: 1,
    backgroundColor: "#26263a",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  userLabel: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  userValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
  infoBox: {
    flex: 1,
    backgroundColor: "#23232b",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoLabel: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  infoValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
  memoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#23232b",
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    marginTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  memoLabel: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
    marginRight: 8,
    marginTop: 2,
  },
  memoValue: {
    color: "#d1d5db",
    fontSize: 15,
    fontStyle: "italic",
    fontWeight: "400",
    flex: 1,
    marginTop: 2,
  },
  attachmentsBox: {
    marginBottom: 18,
    marginTop: 6,
  },
  attachmentsLabel: {
    color: "#a1a1aa",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#23232b",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  attachmentText: {
    flex: 1,
    color: ACCENT,
    fontSize: 14,
    textDecorationLine: "underline",
    fontWeight: "500",
  },
  attachmentSize: {
    color: "#a1a1aa",
    fontSize: 12,
    marginLeft: 4,
  },
  balanceBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#23232b",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    marginTop: 8,
    justifyContent: "center",
  },
  balanceLabel: {
    color: "#a1a1aa",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
    marginRight: 8,
  },
  balanceValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 4,
    marginRight: 8,
  },
  refreshButton: {
    marginLeft: 8,
    backgroundColor: "#23232b",
  },
  balanceWarning: {
    color: ERROR,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "column",
    gap: 14,
    width: "100%",
    marginTop: 24,
    alignItems: "stretch",
  },
  confirmButton: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 4,
    shadowColor: ACCENT,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmButtonDisabled: {
    backgroundColor: "#6b7280",
    opacity: 0.7,
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  denyButton: {
    backgroundColor: ERROR,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 4,
    shadowColor: ERROR,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  denyButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  cancelButton: {
    backgroundColor: "#374151",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 4,
    shadowColor: "#374151",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  backButton: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 24,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
