import Constants from 'expo-constants';
import { StreamChat } from 'stream-chat';

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

// Connect user to Stream Chat with optional avatar and display name
export const connectChatUser = async (username: string, token: string, avatarUrl?: string, displayName?: string) => {
    try {
        console.log('Connecting chat user:', username, 'displayName:', displayName);

        const client = initializeChatClient();

        const userObject: any = {
            id: username,
            name: displayName || username, // Use displayName if provided, otherwise use username
        };

        // Add avatar if provided
        if (avatarUrl) {
            userObject.image = avatarUrl;
        }

        console.log('Stream Chat user object:', userObject);

        await client.connectUser(userObject, token);

        setChatUser(username);
        console.log('Successfully connected to Stream Chat');
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

// Update user display name in Stream Chat
export const updateChatUserDisplayName = async (displayName: string) => {
    try {
        if (!chatClient || !chatUserId) {
            console.error('Chat client or user not initialized');
            return;
        }

        await chatClient.partialUpdateUser({
            id: chatUserId,
            set: { name: displayName },
        });

        console.log('Chat user display name updated successfully');
    } catch (error) {
        console.error('Error updating chat user display name:', error);
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
        console.log('Disconnected from Stream Chat');
    } catch (error) {
        console.error('Error disconnecting chat user:', error);
    }
};

// Check if chat is connected
export const isChatConnected = (): boolean => {
    return chatClient?.userID != null;
};

// Function to get existing user data from server
export const fetchExistingUserData = async (getAccessToken: () => Promise<string | null>): Promise<{
    username: string | null;
    chatToken: string | null;
    avatarUrl: string | null;
    displayName: string | null;
}> => {
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            console.log('No access token available');
            return { username: null, chatToken: null, avatarUrl: null, displayName: null };
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
                displayName: data.displayName || data.display_name || null, // Handle both field names
            };
        } else if (response.status === 404) {
            // User doesn't have a username yet - this is expected for new/legacy users
            console.log('User does not have username set up yet (404)');
            return { username: null, chatToken: null, avatarUrl: null, displayName: null };
        } else {
            console.error('Unexpected response status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return { username: null, chatToken: null, avatarUrl: null, displayName: null };
        }
    } catch (error) {
        console.error('Error fetching existing user data:', error);
        return { username: null, chatToken: null, avatarUrl: null, displayName: null };
    }
};

// Create new username and get chat token
export const createUsernameAndToken = async (
    username: string,
    displayName: string,
    getAccessToken: () => Promise<string | null>
): Promise<{
    success: boolean;
    username?: string;
    displayName?: string;
    chatToken?: string;
    error?: string;
}> => {
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return { success: false, error: 'Authentication failed. Please try logging in again.' };
        }

        console.log('Creating username and getting token:', username, displayName);

        const response = await fetch(`${API_URL}/chat/create-username`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                username: username.toLowerCase(),
                displayName: displayName.trim(),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();

            if (response.status === 409) {
                return { success: false, error: 'Username already taken. Please choose another.' };
            } else if (response.status === 400) {
                return { success: false, error: errorData.message || 'Invalid username or display name format.' };
            } else if (response.status === 401) {
                return { success: false, error: 'Authentication expired. Please try logging in again.' };
            } else {
                return { success: false, error: errorData.message || 'Failed to create username' };
            }
        }

        const data = await response.json();
        console.log('Username creation response:', data);

        return {
            success: true,
            username: data.username,
            displayName: data.displayName,
            chatToken: data.chatToken,
        };
    } catch (error) {
        console.error('Error creating username:', error);
        return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
};

// Search for users by username or display name
export const searchUsers = async (
    query: string,
    getAccessToken: () => Promise<string | null>
): Promise<{
    success: boolean;
    users?: {
        username: string;
        displayName?: string;
        avatarUrl?: string;
    }[];
    error?: string;
}> => {
    try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            return { success: false, error: 'Authentication required' };
        }

        const response = await fetch(`${API_URL}/chat/search-users?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            return { success: false, error: errorData.message || 'Failed to search users' };
        }

        const data = await response.json();
        return {
            success: true,
            users: data.users || [],
        };
    } catch (error) {
        console.error('Error searching users:', error);
        return { success: false, error: 'Network error. Please try again.' };
    }
};
