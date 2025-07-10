import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ChannelList } from "stream-chat-expo";
import { useRouter } from "expo-router";
import { useChatContext } from "../contexts/ChatContext";
import { chatUserId } from "../config/chatConfig";
import { FAB } from "react-native-paper";

const DARK_BG = "#18181b";

// Filter for direct messages only
const filters = {
  members: { $in: [chatUserId] },
  type: "messaging",
  member_count: 2, // Only 1-on-1 conversations
};

const sort = [{ last_message_at: -1 as const }];

const options = {
  state: true,
  watch: true,
  limit: 30,
};

export default function ChatScreen() {
  const router = useRouter();
  const { setChannel } = useChatContext();
  const memoizedFilters = useMemo(() => filters, []);

  const startNewChat = () => {
    router.push('/newchat');
  };

  return (
    <View style={styles.container}>
      <ChannelList
        filters={memoizedFilters}
        options={options}
        sort={sort}
        onSelect={(channel) => {
          setChannel(channel);
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3b82f6',
  },
});
