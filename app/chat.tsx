import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ChannelList } from "stream-chat-expo";
import { useRouter } from "expo-router";
import { chatUserId } from "../config/chatConfig";
import { FAB, Text } from "react-native-paper";
import { usePrivy } from "@privy-io/expo";
import { useChatContext } from "../contexts/ChatContext";

const DARK_BG = "#18181b";

export default function ChatScreen() {
  const { isReady, user } = usePrivy();
  const router = useRouter();
  const { setChannel } = useChatContext();

  // Move all hooks to the top level of the component
  const memoizedFilters = useMemo(() => {
    if (!chatUserId) return {};
    return {
      members: { $in: [chatUserId] },
      type: "messaging",
      member_count: 2, // Only 1-on-1 conversations
    };
  }, []);

  const sort = useMemo(() => [{ last_message_at: -1 as const }], []);

  const options = useMemo(() => ({
    state: true,
    watch: true,
    limit: 30,
  }), []);

  const startNewChat = () => {
    router.push('/newchat');
  };

  // Show loading state while Privy is initializing
  if (!isReady) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={{ color: "#fff" }}>Loading...</Text>
      </View>
    );
  }

  // Show warning if user is not authenticated (like account page)
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={{ color: "#fff" }}>Please login to access chat</Text>
        </View>
      </View>
    );
  }

  // Show message if no chat user ID (username not set up)
  if (!chatUserId) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={{ color: "#fff" }}>Please set up your username to access chat</Text>
        </View>
      </View>
    );
  }

  // Render the chat list when everything is ready
  return (
    <View style={styles.container}>
      <ChannelList
        filters={memoizedFilters}
        options={options}
        sort={sort}
        onSelect={(channel) => {
          console.log('Channel selected:', channel.cid);
          setChannel(channel); // Set the channel in context
          router.push(`/channel/${channel.cid}`);
        }}
        additionalFlatListProps={{
          style: { backgroundColor: DARK_BG },
        }}
      />
      
      {/* Floating Action Button to start new chat */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={startNewChat}
        color="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3b82f6',
  },
});
