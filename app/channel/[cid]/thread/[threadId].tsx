import React, { useContext } from "react";
import { SafeAreaView, Text, View } from "react-native";
import { Channel, Thread } from "stream-chat-expo";
import { Stack } from "expo-router";
import { useChatContext } from "../../../../contexts/ChatContext";
import { useHeaderHeight } from "@react-navigation/elements";

const DARK_BG = "#18181b";

export default function ThreadScreen() {
  const { channel, thread, setThread } = useChatContext();
  const headerHeight = useHeaderHeight();

  if (!channel) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: DARK_BG }}>
        <Stack.Screen options={{ title: "Thread" }} />
        <Text style={{ color: "#fff", textAlign: "center", marginTop: 50 }}>
          Loading chat...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DARK_BG }}>
      <Stack.Screen 
        options={{ 
          title: "Thread",
          headerStyle: { backgroundColor: DARK_BG },
          headerTintColor: "#fff"
        }} 
      />
      <Channel
        channel={channel}
        keyboardVerticalOffset={headerHeight}
        thread={thread}
        threadList
      >
        <View style={{ flex: 1, justifyContent: "flex-start" }}>
          <Thread
            onThreadDismount={() => {
              setThread(undefined);
            }}
          />
        </View>
      </Channel>
    </SafeAreaView>
  );
}
