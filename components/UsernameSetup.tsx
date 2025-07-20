import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

const DARK_BG = "#18181b";
const PURPLE_800 = "#6d28d9";
const API_URL = Constants.expoConfig?.extra?.apiUrl;

interface UsernameSetupProps {
    onUsernameSet: (username: string, displayName: string) => void; // Updated to include displayName
    getAccessToken: () => Promise<string | null>;
    isLoading?: boolean;
}

export const UsernameSetup: React.FC<UsernameSetupProps> = ({
    onUsernameSet,
    getAccessToken,
    isLoading
}) => {
    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);

    const wallet = useEmbeddedSolanaWallet();

    const walletAddress =
        wallet?.wallets && wallet.wallets.length > 0 && wallet.wallets[0]?.address
            ? wallet.wallets[0]?.address
            : null;

    // Auto-generate username from display name
    useEffect(() => {
        if (displayName) {
            // Generate username from display name
            const generated = displayName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
                .slice(0, 20); // Limit to 20 chars

            setUsername(generated);
        }
    }, [displayName]);

    const validateDisplayName = (input: string): boolean => {
        // Allow letters, spaces, basic punctuation, 1-30 characters
        const validCharsRegex = /^[a-zA-Z0-9\s\-_.]+$/;

        if (input.length === 0) {
            setError("Display name is required");
            return false;
        }

        if (input.length > 30) {
            setError("Display name must be 30 characters or less");
            return false;
        }

        if (!validCharsRegex.test(input)) {
            setError("Display name can only contain letters, numbers, spaces, and basic punctuation (- _ .)");
            return false;
        }

        setError("");
        return true;
    };

    const validateUsername = (input: string): boolean => {
        // Only alphanumeric ASCII characters, 1-20 length
        const alphanumericRegex = /^[a-zA-Z0-9]+$/;

        if (input.length === 0) {
            setError("Username is required");
            return false;
        }

        if (input.length > 20) {
            setError("Username must be 20 characters or less");
            return false;
        }

        if (!alphanumericRegex.test(input)) {
            setError("Username can only contain letters and numbers");
            return false;
        }

        setError("");
        return true;
    };

    const handleDisplayNameChange = (text: string) => {
        // Allow letters, numbers, spaces, and basic punctuation
        const cleaned = text.replace(/[^a-zA-Z0-9\s\-_.]/g, '');

        // Limit to 30 characters
        const limited = cleaned.slice(0, 30);

        setDisplayName(limited);

        if (limited !== text) {
            setError("Only letters, numbers, spaces, and basic punctuation allowed");
            setTimeout(() => setError(""), 2000);
        } else if (error) {
            setError("");
        }
    };

    const handleUsernameChange = (text: string) => {
        // Remove any non-alphanumeric characters as user types
        const cleaned = text.replace(/[^a-zA-Z0-9]/g, '');

        // Limit to 20 characters
        const limited = cleaned.slice(0, 20);

        setUsername(limited);

        if (limited !== text) {
            setError("Only letters and numbers allowed");
            setTimeout(() => setError(""), 2000);
        } else if (error) {
            setError("");
        }
    };

    const createUsername = async (username: string, displayName: string): Promise<boolean> => {
        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                setError("Authentication failed. Please try logging in again.");
                return false;
            }

            const response = await fetch(`${API_URL}/chat/create-username`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    username: username.toLowerCase(),
                    displayName: displayName.trim(), // Add display name to API call
                    walletAddress: walletAddress, // Include wallet address
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();

                if (response.status === 409) {
                    setError("Username already taken. Please choose another.");
                    return false;
                } else if (response.status === 400) {
                    setError(errorData.message || "Invalid username or display name format.");
                    return false;
                } else if (response.status === 401) {
                    setError("Authentication expired. Please try logging in again.");
                    return false;
                } else {
                    throw new Error(errorData.message || 'Failed to create username');
                }
            }

            return true;
        } catch (error) {
            console.error('Error creating username:', error);
            setError("Network error. Please check your connection and try again.");
            return false;
        }
    };

    const handleSubmit = async () => {
        if (!validateDisplayName(displayName) || !validateUsername(username)) {
            return;
        }

        setCreating(true);
        setError("");

        try {
            const success = await createUsername(username, displayName);
            if (success) {
                onUsernameSet(username.toLowerCase(), displayName.trim());
            }
        } catch (error) {
            console.error("Error creating username:", error);
            setError("Failed to create username. Please try again.");
        } finally {
            setCreating(false);
        }
    };

    const isSubmitDisabled = !displayName.trim() || !username.trim() || creating || isLoading;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Card style={styles.card}>
                    <Card.Title
                        title="Create Your Profile"
                        titleStyle={styles.title}
                    />
                    <Card.Content>
                        <Text style={styles.description}>
                            Choose how others will see you and your unique handle.
                        </Text>

                        {/* Display Name Field */}
                        <Text style={styles.fieldLabel}>Display Name</Text>
                        <Text style={styles.fieldDescription}>
                            This is what others will see (e.g., &ldquo;John Smith&ldquo;)
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your display name"
                            placeholderTextColor="#a3a3a3"
                            value={displayName}
                            onChangeText={handleDisplayNameChange}
                            autoCapitalize="words"
                            autoCorrect={false}
                            maxLength={30}
                            editable={!creating}
                        />

                        <View style={styles.charCount}>
                            <Text style={styles.charCountText}>
                                {displayName.length}/30 characters
                            </Text>
                        </View>

                        {/* Username Field */}
                        <Text style={styles.fieldLabel}>Username</Text>
                        <Text style={styles.fieldDescription}>
                            Your unique handle (e.g., &ldquo;johnsmith123&ldquo;)
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Auto-generated or customize"
                            placeholderTextColor="#a3a3a3"
                            value={username}
                            onChangeText={handleUsernameChange}
                            autoCapitalize="none"
                            autoCorrect={false}
                            maxLength={20}
                            onSubmitEditing={handleSubmit}
                            returnKeyType="done"
                            editable={!creating}
                        />

                        <View style={styles.charCount}>
                            <Text style={styles.charCountText}>
                                {username.length}/20 characters
                            </Text>
                        </View>

                        {error ? (
                            <Text style={styles.errorText}>{error}</Text>
                        ) : null}

                        <Button
                            mode="contained"
                            onPress={handleSubmit}
                            disabled={isSubmitDisabled}
                            loading={creating}
                            style={styles.button}
                            labelStyle={styles.buttonLabel}
                        >
                            {creating ? "Creating..." : "Create Profile"}
                        </Button>
                    </Card.Content>
                </Card>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DARK_BG,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    card: {
        width: "100%",
        maxWidth: 400,
        backgroundColor: "#27272a",
    },
    title: {
        color: "#fff",
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
    },
    description: {
        color: "#a3a3a3",
        fontSize: 16,
        textAlign: "center",
        marginBottom: 24,
    },
    fieldLabel: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
        marginTop: 8,
    },
    fieldDescription: {
        color: "#a3a3a3",
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: "#1e1e1e",
        color: "#fff",
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#374151",
        fontSize: 18,
        marginBottom: 8,
    },
    charCount: {
        alignItems: "flex-end",
        marginBottom: 16,
    },
    charCountText: {
        color: "#a3a3a3",
        fontSize: 12,
    },
    errorText: {
        color: "#ef4444",
        fontSize: 14,
        textAlign: "center",
        marginBottom: 16,
    },
    button: {
        backgroundColor: PURPLE_800,
        paddingVertical: 8,
        marginTop: 8,
    },
    buttonLabel: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
});