import { useHeaderHeight } from "@react-navigation/elements";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { SafeAreaView, Text } from "react-native";
import { Channel, MessageInput, MessageList, useChatContext } from "stream-chat-expo";
import { chatClient, chatUserId } from "../../config/chatConfig";

const DARK_BG = "#18181b";

export default function ChannelScreen() {
    const { channel, setActiveChannel } = useChatContext();
    const { cid } = useLocalSearchParams();
    const headerHeight = useHeaderHeight();

    // If no channel in context, try to get it from the client
    useEffect(() => {
        const loadChannel = async () => {
            if (!channel && cid && chatClient) {
                try {
                    console.log('Loading channel from cid:', cid);
                    const channelInstance = chatClient.channel('messaging', cid as string);
                    await channelInstance.watch();
                    setActiveChannel(channelInstance);
                } catch (error) {
                    console.error('Error loading channel:', error);
                }
            }
        };

        loadChannel();
    }, [cid, channel, setActiveChannel]);

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
                disableTypingIndicator={false}
            >
                <MessageList />
                <MessageInput />
            </Channel>
        </SafeAreaView>
    );
}
