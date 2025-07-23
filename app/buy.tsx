import React from "react";
import { View, StyleSheet } from "react-native";
import { Appbar, Text } from "react-native-paper";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";

export default function FiatOnRampScreen() {
    const router = useRouter();
    const wallet = useEmbeddedSolanaWallet();

    const walletAddress =
        wallet?.wallets && wallet.wallets.length > 0 && wallet.wallets[0]?.address
            ? wallet.wallets[0]?.address
            : null;

    // Build the widget URL with the user's wallet address
    const widgetUrl = `https://widget.coindisco.com/?defaultAsset=usdc&wallets=solana%3A${walletAddress}&theme=dark&widgetId=demo&publicKey=pk_prod_01K0C9YPGQD0W9155JB6C57E88&defaultNetwork=solana&buttonBackground=D621FF&iconsColor=D621FF`;

    return (
        <View style={styles.container}>
            <Appbar.Header style={styles.header}>
                <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
                <Appbar.Content title="Fiat On-Ramp" titleStyle={styles.headerTitle} />
            </Appbar.Header>
            {walletAddress ? (
                <WebView
                    source={{ uri: widgetUrl }}
                    style={styles.webview}
                    originWhitelist={['*']}
                    allowsInlineMediaPlayback
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                />
            ) : (
                <View style={styles.errorContainer}>
                    <Text style={styles.loginMessage}>
                        Please log in to use the fiat on-ramp
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#18181b",
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
    webview: {
        flex: 1,
        backgroundColor: "#18181b",
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    errorText: {
        color: "#fff",
        fontSize: 18,
        textAlign: "center",
    },
    loginMessage: {
        color: "#f87171",        // Consistent error color
        fontSize: 18,            // Consistent font size
        fontWeight: "500",       // Medium weight
        textAlign: "center",     // Centered
        marginTop: 24,           // Some spacing
        marginHorizontal: 24,    // Padding for smaller screens
    },
});
