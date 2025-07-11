import React, { useState } from "react";
import { View, TextInput, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Text } from "react-native-paper";
import Constants from "expo-constants";

const DARK_BG = "#18181b";
const PURPLE_800 = "#6d28d9";
const API_URL = Constants.expoConfig?.extra?.apiUrl;

interface UsernameSetupProps {
  onUsernameSet: (username: string) => void;
  getAccessToken: () => Promise<string | null>; // Updated to match actual return type
  isLoading?: boolean;
}

export const UsernameSetup: React.FC<UsernameSetupProps> = ({ 
  onUsernameSet, 
  getAccessToken, 
  isLoading 
}) => {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

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

  const handleUsernameChange = (text: string) => {
    // Remove any non-alphanumeric characters as user types
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, '');
    
    // Limit to 20 characters
    const limited = cleaned.slice(0, 20);
    
    setUsername(limited);
    
    if (limited !== text) {
      // Show a brief message if characters were removed
      setError("Only letters and numbers allowed");
      setTimeout(() => setError(""), 2000);
    } else if (error) {
      setError("");
    }
  };

    const createUsername = async (username: string): Promise<boolean> => {
    try {
      const accessToken = await getAccessToken();
      
      // Handle null access token
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error cases
        if (response.status === 409) {
          setError("Username already taken. Please choose another.");
          return false;
        } else if (response.status === 400) {
          setError(errorData.message || "Invalid username format.");
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
    if (!validateUsername(username)) {
      return;
    }

    setCreating(true);
    setError("");

    try {
      const success = await createUsername(username);
      if (success) {
        onUsernameSet(username.toLowerCase());
      }
    } catch (error) {
      setError("Failed to create username. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const isSubmitDisabled = !username.trim() || creating || isLoading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Title 
            title="Create Username" 
            titleStyle={styles.title} 
          />
          <Card.Content>
            <Text style={styles.description}>
              Choose a unique username for chat. Only letters and numbers allowed, up to 20 characters.
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter username"
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
              {creating ? "Creating..." : "Create Username"}
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
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
