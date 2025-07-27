import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Appbar, FAB, Text } from "react-native-paper";
import { ChannelList, Theme } from "stream-chat-expo";
import { useAppStore } from "../store/Store";
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
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
          <Appbar.Content title="Chat" titleStyle={styles.headerTitle} />
        </Appbar.Header>
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
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
          <Appbar.Content title="Chat" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <View style={styles.centerContent}>
          <Text style={styles.loginMessage}>Please login to access chat</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
        <Appbar.Content title="Chat" titleStyle={styles.headerTitle} />
      </Appbar.Header>
      <ChannelList
        filters={memoizedFilters}
        options={options}
        sort={sort}
        onSelect={(channel) => {
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
  loginMessage: {
    color: "#f87171",
    fontSize: 18,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 24,
    marginHorizontal: 24,
  },
});
