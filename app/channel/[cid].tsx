import React from "react";
import { SafeAreaView, Text, View } from "react-native";
import { Channel, MessageInput, MessageList } from "stream-chat-expo";
import { Stack, useRouter } from "expo-router";
import { useChatContext } from "../../contexts/ChatContext";
import { useHeaderHeight } from "@react-navigation/elements";
import { chatUserId } from "../../config/chatConfig";

const DARK_BG = "#18181b";

export default function ChannelScreen() {
  const { channel, setThread } = useChatContext();
  const router = useRouter();
  const headerHeight = useHeaderHeight();

  if (!channel) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: DARK_BG }}>
        <Stack.Screen options={{ title: "Chat" }} />
        <Text style={{ color: "#fff", textAlign: "center", marginTop: 50 }}>
          Loading chat...
        </Text>
      </SafeAreaView>
    );
  }

  // Get the other user's name for the header
  const otherMember = Object.values(channel.state.members).find(
    member => member.user?.id !== chatUserId
  );
  const otherUserName = otherMember?.user?.name || otherMember?.user?.id || 'Chat';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen 
        options={{ 
          title: otherUserName,
          headerStyle: { backgroundColor: DARK_BG },
          headerTintColor: "#fff"
        }} 
      />
      <Channel 
        channel={channel} 
        keyboardVerticalOffset={headerHeight}
        audioRecordingEnabled
        // Disable threads for simpler Telegram-like experience
        disableTypingIndicator={false}
      >
        <MessageList />
        <MessageInput />
      </Channel>
    </SafeAreaView>
  );
}
