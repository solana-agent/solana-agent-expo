import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { FAB, Text } from "react-native-paper";
import { ChannelList } from "stream-chat-expo";
import { useAppStore } from "../components/Store";
import { chatClient } from "../config/chatConfig";

const DARK_BG = "#18181b";

export default function ChatScreen() {
  const router = useRouter();
  const { username, checkingUsername } = useAppStore();

  const memoizedFilters = useMemo(() => {
    if (!username) return {};
    return {
      members: { $in: [username] },
      type: "messaging",
      member_count: 2,
    };
  }, [username]);

  const sort = useMemo(() => [{ last_message_at: -1 as const }], []);

  const options = useMemo(() => ({
    state: true,
    watch: true,
    limit: 30,
  }), []);

  const startNewChat = () => {
    router.push('/newchat');
  };

  // Show loading state
  if (checkingUsername) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={{ color: "#fff" }}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Show message if no username or chat client
  if (!username || !chatClient) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={{ color: "#fff" }}>Please set up your username to access chat</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ChannelList
        filters={memoizedFilters}
        options={options}
        sort={sort}
        onSelect={(channel) => {
          console.log('Channel selected:', channel.cid);
          // Extract just the channel ID part after the colon
          // Format: "messaging:channelId" -> "channelId"
          const channelId = channel.cid.split(':')[1] || channel.cid;
          router.push(`/channel/${channelId}`);
        }}
        additionalFlatListProps={{
          style: { backgroundColor: DARK_BG },
        }}
      />

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
