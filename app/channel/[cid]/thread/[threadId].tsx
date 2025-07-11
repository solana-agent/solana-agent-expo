import { useHeaderHeight } from "@react-navigation/elements";
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaView, Text, View } from "react-native";
import { Channel, Thread, useChatContext, useThreadContext } from "stream-chat-expo";

const DARK_BG = "#18181b";

export default function ThreadScreen() {
    const { channel } = useChatContext();
    const { thread } = useThreadContext();
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
                    <Thread />
                </View>
            </Channel>
        </SafeAreaView>
    );
}
