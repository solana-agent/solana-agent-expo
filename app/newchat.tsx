import { Stack, useRouter } from "expo-router";
import React from "react";
import { Alert, SafeAreaView } from "react-native";
import { useChatContext } from "stream-chat-expo";
import { UserSearch } from "../components/UserSearch";
import { chatUserId } from "../config/chatConfig";

const DARK_BG = "#18181b";

export default function NewChatScreen() {
    const router = useRouter();
    const { client, setActiveChannel } = useChatContext();

    const handleUserSelect = async (userId: string) => {
        try {
            // Create or get existing DM channel
            const channel = client.channel('messaging', {
                members: [chatUserId, userId],
            });

            await channel.create();
            setActiveChannel(channel);

            // Navigate to the chat
            router.replace(`/channel/${channel.cid}`);
        } catch (error) {
            console.error("Error starting chat:", error);
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
