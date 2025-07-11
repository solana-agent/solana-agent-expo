import AsyncStorage from '@react-native-async-storage/async-storage';
import { StreamChat } from 'stream-chat';
import Constants from 'expo-constants';

export const chatApiKey = Constants.expoConfig?.extra?.streamChatApiKey || "your-fallback-key";
const API_URL = Constants.expoConfig?.extra?.apiUrl;

// These will be set dynamically after username creation/retrieval
export let chatUserId = "";
export let chatUserName = "";
export let chatClient: StreamChat | null = null;

export const setChatUser = (username: string) => {
  chatUserId = username;
  chatUserName = username;
};

export const getChatUser = () => ({
  id: chatUserId,
  name: chatUserName,
});

// Initialize Stream Chat client
export const initializeChatClient = () => {
  if (!chatClient) {
    chatClient = StreamChat.getInstance(chatApiKey, {
      timeout: 6000,
    });
  }
  return chatClient;
};

// Connect user to Stream Chat with optional avatar
export const connectChatUser = async (username: string, token: string, avatarUrl?: string) => {
  try {
    const client = initializeChatClient();
    
    const userObject: any = {
      id: username,
      name: username,
    };

    // Add avatar if provided
    if (avatarUrl) {
      userObject.image = avatarUrl;
    }
    
    await client.connectUser(userObject, token);
    
    setChatUser(username);
    return client;
  } catch (error) {
    console.error('Error connecting chat user:', error);
    throw error;
  }
};

// Update user avatar in Stream Chat
export const updateChatUserAvatar = async (avatarUrl: string | null) => {
  try {
    if (!chatClient || !chatUserId) {
      console.error('Chat client or user not initialized');
      return;
    }

    const updateData: any = {};
    if (avatarUrl) {
      updateData.image = avatarUrl;
    } else {
      // Remove avatar by setting image to undefined
      updateData.image = undefined;
    }

    await chatClient.partialUpdateUser({
      id: chatUserId,
      set: updateData,
    });

    console.log('Chat user avatar updated successfully');
  } catch (error) {
    console.error('Error updating chat user avatar:', error);
    throw error;
  }
};

// Disconnect user from Stream Chat
export const disconnectChatUser = async () => {
  try {
    if (chatClient) {
      await chatClient.disconnectUser();
      chatClient = null;
    }
    setChatUser("");
  } catch (error) {
    console.error('Error disconnecting chat user:', error);
  }
};

// Storage keys
const STORAGE_KEYS = {
  USERNAME: 'chat_username',
  CHAT_TOKEN: 'chat_token',
  AVATAR_URL: 'chat_avatar_url',
};

export const storeUsername = async (username: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username);
    setChatUser(username);
  } catch (error) {
    console.error('Error storing username:', error);
    throw error;
  }
};

export const storeChatToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CHAT_TOKEN, token);
  } catch (error) {
    console.error('Error storing chat token:', error);
    throw error;
  }
};

export const storeAvatarUrl = async (avatarUrl: string | null): Promise<void> => {
  try {
    if (avatarUrl) {
      await AsyncStorage.setItem(STORAGE_KEYS.AVATAR_URL, avatarUrl);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.AVATAR_URL);
    }
  } catch (error) {
    console.error('Error storing avatar URL:', error);
    throw error;
  }
};

export const getStoredUsername = async (): Promise<string | null> => {
  try {
    const username = await AsyncStorage.getItem(STORAGE_KEYS.USERNAME);
    if (username) {
      setChatUser(username);
    }
    return username;
  } catch (error) {
    console.error('Error getting stored username:', error);
    return null;
  }
};

export const getStoredChatToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.CHAT_TOKEN);
  } catch (error) {
    console.error('Error getting stored chat token:', error);
    return null;
  }
};

export const getStoredAvatarUrl = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.AVATAR_URL);
  } catch (error) {
    console.error('Error getting stored avatar URL:', error);
    return null;
  }
};

export const clearStoredData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USERNAME, 
      STORAGE_KEYS.CHAT_TOKEN, 
      STORAGE_KEYS.AVATAR_URL
    ]);
    await disconnectChatUser();
  } catch (error) {
    console.error('Error clearing stored data:', error);
  }
};

// Function to get existing user data from server
export const fetchExistingUserData = async (getAccessToken: () => Promise<string | null>): Promise<{
  username: string | null;
  chatToken: string | null;
  avatarUrl: string | null;
}> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.log('No access token available');
      return { username: null, chatToken: null, avatarUrl: null };
    }

    console.log('Fetching user data from server...');
    const response = await fetch(`${API_URL}/chat/user-info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Server response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('Server response data:', data);
      
      return {
        username: data.username || null,
        chatToken: data.chatToken || data.chat_token || null, // Handle both field names
        avatarUrl: data.avatarUrl || data.avatar_url || null, // Handle both field names
      };
    } else if (response.status === 404) {
      // User doesn't have a username yet - this is expected for new/legacy users
      console.log('User does not have username set up yet (404)');
      return { username: null, chatToken: null, avatarUrl: null };
    } else {
      console.error('Unexpected response status:', response.status);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return { username: null, chatToken: null, avatarUrl: null };
    }
  } catch (error) {
    console.error('Error fetching existing user data:', error);
    return { username: null, chatToken: null, avatarUrl: null };
  }
};
