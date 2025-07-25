import { useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import * as Clipboard from 'expo-clipboard';
import Constants from "expo-constants";
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { ActivityIndicator, Appbar, Button, IconButton, Text, Menu } from "react-native-paper";
import { useRouter } from "expo-router";
import { PushNotificationService } from '../components/PushNotificationService';
import { useAppStore } from './store/Store';
import { disconnectChatUser } from "../config/chatConfig";

const DARK_NAV = "#18181b";
const API_URL = Constants.expoConfig?.extra?.apiUrl;

export default function AccountScreen() {
  const { isReady, user, logout, getAccessToken } = usePrivy();
  const wallet = useEmbeddedSolanaWallet();
  const router = useRouter();

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const walletAddress =
    wallet?.wallets && wallet.wallets.length > 0 && wallet.wallets[0]?.address
      ? wallet.wallets[0]?.address
      : null;

  const {
    username,
    setUsername,
    avatarUrl,
    setAvatarUrl,
    displayName,
    setDisplayName,
    clearChatData
  } = useAppStore();

  // Load username, display name and avatar on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Get username from storage or chat config
        if (username) {
          setUsername(username);

          // Load user data from server
          const accessToken = await getAccessToken();
          if (accessToken) {
            const response = await fetch(`${API_URL}/chat/user-info`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const userData = await response.json();
              if (userData.avatarUrl) {
                setAvatarUrl(userData.avatarUrl);
              }
              if (userData.displayName) {
                setDisplayName(userData.displayName);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    if (user) {
      loadUserData();
    }
  }, [user, getAccessToken, username, setUsername, setDisplayName, setAvatarUrl]);


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

  useEffect(() => {
    if (user && walletAddress) {
      fetchUsdcBalance();
    }
  }, [user, walletAddress]);

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

  // Handle logout with store clearing
  const handleLogout = async () => {
    try {
      // Clear the app store first
      clearChatData();

      // Then disconnect the chat user
      await disconnectChatUser();

      // Then logout from Privy
      await logout();

      console.log('Logged out and cleared store');
    } catch (error) {
      console.error('Error during logout:', error);
      // Still clear the store even if logout fails
      clearChatData();
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied!", `${label} copied to clipboard`);
  };

  const selectAndUploadAvatar = async () => {
    try {
      // Request permission to access media library
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert("Permission required", "Permission to access photos is required to upload an avatar.");
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await uploadAvatar(asset);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploadingAvatar(true);

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('avatar', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'avatar.jpg',
      } as any);

      const response = await fetch(`${API_URL}/chat/upload-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const data = await response.json();
      setAvatarUrl(data.avatarUrl);
      Alert.alert("Success", "Avatar updated successfully!");

    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert("Upload failed", "Failed to upload avatar. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    try {
      Alert.alert(
        "Remove Avatar",
        "Are you sure you want to remove your avatar?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                const accessToken = await getAccessToken();
                if (!accessToken) return;

                const response = await fetch(`${API_URL}/chat/remove-avatar`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                });

                if (response.ok) {
                  setAvatarUrl(null);
                  Alert.alert("Success", "Avatar removed successfully!");
                }
              } catch (error) {
                console.error('Error removing avatar:', error);
                Alert.alert("Error", "Failed to remove avatar.");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in removeAvatar:', error);
    }
  };

  if (isReady && user && walletAddress)
    return (
      <View style={{ flex: 1, backgroundColor: DARK_NAV }}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
          <Appbar.Content title="Account" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <View style={styles.accountContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={selectAndUploadAvatar}
                disabled={uploadingAvatar}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.defaultAvatar}>
                    <Text style={styles.avatarPlaceholder}>
                      {username || '?'}
                    </Text>
                  </View>
                )}

                {uploadingAvatar && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}

                <View style={styles.cameraIcon}>
                  <IconButton
                    icon="camera"
                    iconColor="#fff"
                    size={20}
                    style={{ margin: 0 }}
                  />
                </View>
              </TouchableOpacity>

              {avatarUrl && (
                <Button
                  mode="text"
                  onPress={removeAvatar}
                  labelStyle={styles.removeAvatarText}
                  style={{ marginTop: 8 }}
                >
                  Remove Avatar
                </Button>
              )}
            </View>

            {/* USDC Balance Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.addressLabel}>USDC Balance</Text>
              <View style={styles.addressContainer}>
                <View style={styles.addressBox}>
                  {loadingBalance ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.addressText}>
                      {usdcBalance !== null ? `${Number(usdcBalance).toFixed(2)} USDC` : '—'}
                    </Text>
                  )}
                </View>
                <IconButton
                  icon="refresh"
                  iconColor="#3b82f6"
                  size={24}
                  onPress={fetchUsdcBalance}
                  style={styles.copyButton}
                />
              </View>
            </View>

            {/* Display Name Section */}
            {displayName && (
              <View style={styles.sectionContainer}>
                <Text style={styles.displayNameLabel}>Name</Text>
                <View style={styles.displayNameContainer}>
                  <View style={styles.displayNameBox}>
                    <Text style={styles.displayNameText}>{displayName}</Text>
                  </View>
                  <IconButton
                    icon="content-copy"
                    iconColor="#a3a3a3"
                    size={24}
                    onPress={() => copyToClipboard(displayName, "Name")}
                    style={styles.copyButton}
                  />
                </View>
              </View>
            )}

            {/* Username Section */}
            {username && (
              <View style={styles.sectionContainer}>
                <Text style={styles.usernameLabel}>Username</Text>
                <View style={styles.usernameContainer}>
                  <View style={styles.usernameBox}>
                    <Text style={styles.usernameText}>@{username}</Text>
                  </View>
                  <IconButton
                    icon="content-copy"
                    iconColor="#a3a3a3"
                    size={24}
                    onPress={() => copyToClipboard(username, "Username")}
                    style={styles.copyButton}
                  />
                </View>
              </View>
            )}

            {/* Wallet Address Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.addressLabel}>Wallet Address</Text>
              <View style={styles.addressContainer}>
                <View style={styles.addressBox}>
                  <Text selectable style={styles.addressText}>{walletAddress}</Text>
                </View>
                <IconButton
                  icon="content-copy"
                  iconColor="#a3a3a3"
                  size={24}
                  onPress={() => copyToClipboard(walletAddress, "Wallet address")}
                  style={styles.copyButton}
                />
              </View>
            </View>

            <Button
              mode="contained"
              onPress={() => handleLogout()}
              style={styles.logoutButton}
              labelStyle={styles.logoutLabel}
              contentStyle={styles.logoutContent}
            >
              Log out
            </Button>
          </ScrollView>
        </View>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: DARK_NAV }}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
        <Appbar.Content title="Account" titleStyle={styles.headerTitle} />
      </Appbar.Header>
      <View style={styles.accountContent}>
        <Text style={styles.loginMessage}>Please login to view your account</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountContent: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    padding: 24,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 16,
  },
  avatarContainer: {
    position: "relative",
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#27272a",
  },
  defaultAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#6d28d9",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholder: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "bold",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#6d28d9",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  removeAvatarText: {
    color: "#ef4444",
    fontSize: 14,
  },
  usernameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  usernameBox: {
    backgroundColor: "#27272a",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    flex: 1,
    maxWidth: 300,
  },
  usernameLabel: {
    color: "#a3a3a3",
    fontSize: 16,
    marginBottom: 6,
    fontWeight: "600",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  usernameText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    width: '100%',
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
  },
  addressText: {
    color: "#fff",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  sectionContainer: {
    alignItems: "flex-start",
    marginBottom: 24,
  },
  currencyDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: "#27272a",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    maxWidth: 300,
  },
  currencyText: {
    color: "#fff",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  menuContent: {
    backgroundColor: "#27272a",
    borderRadius: 8,
  },
  menuItemText: {
    color: "#fff",
  },
  displayNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  displayNameBox: {
    backgroundColor: "#27272a",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    flex: 1,
    maxWidth: 300,
  },
  displayNameLabel: {
    color: "#a3a3a3",
    fontSize: 16,
    marginBottom: 6,
    fontWeight: "600",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  displayNameText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loginMessage: {
    color: "#f87171",        // Consistent error color
    fontSize: 18,            // Consistent font size
    fontWeight: "500",       // Medium weight
    textAlign: "center",     // Centered
    marginTop: 24,           // Some spacing
    marginHorizontal: 24,    // Padding for smaller screens
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
