import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Channel, MessageList, MessageInput, useChatContext } from 'stream-chat-expo';

const DARK_BG = "#18181b";

export default function ChannelScreen() {
    const { client } = useChatContext();
    const { cid } = useLocalSearchParams();
    const [channel, setChannel] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadChannel = async () => {
            try {
                if (!cid || !client) {
                    setError('No channel ID or client available');
                    setLoading(false);
                    return;
                }

                const channelId = cid as string;
                const cleanChannelId = channelId.includes(':') ? channelId.split(':')[1] : channelId;

                console.log('Loading channel from ID:', channelId);

                const channelInstance = client.channel('messaging', cleanChannelId);
                await channelInstance.watch();

                setChannel(channelInstance);
                setError('');
            } catch (err) {
                console.error('Error loading channel:', err);
                setError('Failed to load channel');
            } finally {
                setLoading(false);
            }
        };

        loadChannel();
    }, [cid, client]);

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Text style={styles.loadingText}>Loading channel...</Text>
            </View>
        );
    }

    if (error || !channel) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Text style={styles.errorText}>{error || 'Channel not found'}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Channel channel={channel}>
                <MessageList />
                <MessageInput />
            </Channel>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DARK_BG,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '500',
    },
    errorText: {
        color: '#f87171',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
});
