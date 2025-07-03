import React, { useEffect } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { Button, Text, IconButton, Card } from "react-native-paper";
import * as Clipboard from 'expo-clipboard';
import { usePrivy, useEmbeddedSolanaWallet } from "@privy-io/expo";
import { PushNotificationService } from '../components/PushNotificationService';

const DARK_NAV = "#18181b";

export default function AccountScreen() {
  const { isReady, user, logout, getAccessToken } = usePrivy();
  const wallet = useEmbeddedSolanaWallet();

  const walletAddress =
    wallet?.wallets && wallet.wallets.length > 0 && wallet.wallets[0]?.address
      ? wallet.wallets[0]?.address
      : null;

  useEffect(() => {
    const registerPushNotifications = async () => {
      if (user && walletAddress) {
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
  }, [user, walletAddress, getAccessToken]);

  const copyToClipboard = async () => {
    if (walletAddress) {
      await Clipboard.setStringAsync(walletAddress);
      Alert.alert("Copied!", "Wallet address copied to clipboard");
    }
  };

  if (isReady && user && walletAddress)
    return (
      <View style={{ flex: 1, backgroundColor: DARK_NAV }}>
        <View style={styles.accountContent}>
          {/* Wallet Address Section */}
          <View style={[styles.sectionContainer, { marginTop: 24 }]}>
            <Text style={styles.addressLabel}>Wallet Address</Text>
            <View style={styles.addressContainer}>
              <View style={styles.addressBox}>
                <Text selectable style={styles.addressText}>{walletAddress}</Text>
              </View>
              <IconButton
                icon="content-copy"
                iconColor="#a3a3a3"
                size={24}
                onPress={copyToClipboard}
                style={styles.copyButton}
              />
            </View>
          </View>

          <Button
            mode="contained"
            onPress={() => logout()}
            style={styles.logoutButton}
            labelStyle={styles.logoutLabel}
            contentStyle={styles.logoutContent}
          >
            Log out
          </Button>
        </View>
      </View>
    );
    
  return (
    <View style={{ flex: 1, backgroundColor: DARK_NAV }}>
      <View style={styles.accountContent}>
        <Text style={{ color: "#fff" }}>Please login to view your account</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  addressBox: {
    backgroundColor: "#27272a",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    maxWidth: 300,
    flex: 1,
  },
  copyButton: {
    marginLeft: 8,
  },
  logoutButton: {
    backgroundColor: "#6d28d9",
    width: 220,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 24,
    marginRight: 40,
  },
  logoutLabel: {
    color: "#fff",
    fontSize: 22,
    padding: 8,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  logoutContent: {
    height: 64,
  },
  addressLabel: {
    color: "#a3a3a3",
    fontSize: 16,
    marginBottom: 6,
    fontWeight: "600",
    letterSpacing: 0.5,
    textAlign: "center",
    marginRight: 40,
  },
  addressText: {
    color: "#fff",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  sectionContainer: {
    width: "100%",
  },
});