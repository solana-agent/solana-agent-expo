import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { Appbar, Button } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import Constants from "expo-constants";
import { usePrivy } from "@privy-io/expo";

const API_URL = Constants.expoConfig?.extra?.apiUrl;
const DARK_BG = "#18181b";

// Payment Request type
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

  const handleCancelPayment = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: "#fff", marginTop: 10 }}>Loading payment request...</Text>
      </View>
    );
  }

  if (error || !payment) {
    return (
      <View style={styles.centerContent}>
        <Text style={{ color: "#f87171" }}>{error || "Payment not found"}</Text>
        <Button onPress={() => router.back()} style={{ marginTop: 20 }}>Back</Button>
      </View>
    );
  }

  if (payment.status === "rejected") {
    return (
      <View style={{ flex: 1, backgroundColor: DARK_BG, justifyContent: "center", alignItems: "center" }}>
        <Icon name="close-circle-outline" size={64} color="#ef4444" style={{ marginBottom: 24 }} />
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>Payment Denied</Text>
        <Text style={{ color: "#d1d5db", fontSize: 16, textAlign: "center", marginBottom: 32, paddingHorizontal: 24 }}>
          This payment request has been denied and can no longer be paid.
        </Text>
        <Button mode="contained" onPress={() => router.back()} style={{ backgroundColor: "#374151" }}>
          <Text style={{ color: "#fff" }}>Back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
        <Appbar.Content title="Payment Request" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.modalContent}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Payment Request</Text>
        </View>

        {/* Content */}
        <View style={styles.modalBody}>
          {/* Amount Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Amount</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.amountValue}>
                {payment.amount} USDC
              </Text>
            </View>
          </View>

          {/* Requesting User Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Requesting Payment</Text>
            <Text style={styles.addressText}>
              {payment.to || payment.payer}
            </Text>
          </View>

          {/* Due Date Section */}
          {payment.dueDate && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Due Date</Text>
              <Text style={styles.memoText}>
                {new Date(payment.dueDate * 1000).toLocaleDateString()}
              </Text>
            </View>
          )}

          {/* External ID Section */}
          {payment.externalId && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Reference ID</Text>
              <Text style={styles.memoText}>
                {payment.externalId}
              </Text>
            </View>
          )}

          {/* Memo Section */}
          {payment.memo && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Memo</Text>
              <Text style={styles.memoText}>
                {payment.memo}
              </Text>
            </View>
          )}

          {/* Attachments Section */}
          {payment.attachments && payment.attachments.length > 0 && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Attachments</Text>
              {payment.attachments.map((attachment, index) => (
                <TouchableOpacity
                  key={attachment.id || index}
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
                  onPress={() => {
                    Linking.openURL(attachment.url).catch(err => {
                      console.error('Failed to open attachment:', err);
                    });
                  }}
                >
                  <Icon name="file-pdf-box" size={20} color="#3b82f6" style={{ marginRight: 8 }} />
                  <Text
                    style={{
                      color: "#3b82f6",
                      textDecorationLine: "underline",
                      fontSize: 16,
                      flexShrink: 1,
                      marginRight: 8,
                    }}
                    numberOfLines={1}
                  >
                    {attachment.filename}
                  </Text>
                  <Text style={{ color: "#a1a1aa", fontSize: 12 }}>
                    {attachment.size ? `(${(attachment.size / (1024 * 1024)).toFixed(1)} MB)` : ""}
                  </Text>
                  <Icon name="open-in-new" size={16} color="#a1a1aa" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Fee section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Fee</Text>
            <Text style={styles.payAmountText}>
              {payment.fee_percent}% ({payment.fee_total} USDC)
            </Text>
          </View>

          {/* You will pay section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>You will pay</Text>
            <Text style={styles.payAmountText}>
              {payment.total_amount} USDC
            </Text>
          </View>
        </View>

        {/* Footer Buttons */}
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
    borderBottomColor: "#3f3f46",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  modalContent: {
    padding: 24,
    alignItems: "center",
  },
  modalHeader: {
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  modalBody: {
    marginBottom: 24,
  },
  infoSection: {
    marginBottom: 20,
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#d1d5db",
    marginBottom: 8,
    textAlign: "center",
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  amountValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
  },
  tokenText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
  },
  addressText: {
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
    flexWrap: "wrap",
  },
  memoText: {
    fontSize: 14,
    color: "#d1d5db",
    textAlign: "center",
    fontStyle: "italic",
  },
  payAmountText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
  },
  modalFooter: {
    flexDirection: "column",
    gap: 12,
    width: "100%",
    marginTop: 24,
  },
  confirmButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#374151",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  cancelButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  attachmentItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#374151",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  attachmentText: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14,
  },
  attachmentSize: {
    color: "#a1a1aa",
    fontSize: 12,
  },
  denyButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  denyButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
