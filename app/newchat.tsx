import React from "react";
import { SafeAreaView, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { UserSearch } from "../components/UserSearch";
import { useChatContext as useChattyContext } from "stream-chat-expo";
import { useChatContext } from "../contexts/ChatContext";
import { chatUserId } from "../config/chatConfig";

const DARK_BG = "#18181b";

export default function NewChatScreen() {
  const router = useRouter();
  const { client } = useChattyContext();
  const { setChannel } = useChatContext();

  const handleUserSelect = async (userId: string) => {
    try {
      // Create or get existing DM channel
      const channel = client.channel('messaging', {
        members: [chatUserId, userId],
      });
      
      await channel.create();
      setChannel(channel);
      
      // Navigate to the chat
      router.replace(`/channel/${channel.cid}`);
    } catch (error) {
      Alert.alert("Error", "Could not start chat with this user");
    }
  };

  const handleClose = () => {
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen 
        options={{
          headerShown: false, // We're handling the header in UserSearch
        }}
      />
      <UserSearch 
        onUserSelect={handleUserSelect}
        onClose={handleClose}
      />
    </SafeAreaView>
  );
}
