import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Channel, MessageList, MessageInput, useChatContext } from 'stream-chat-expo';
import { Appbar, Menu } from 'react-native-paper';

const DARK_BG = "#18181b";

export default function ChannelScreen() {
    const { client } = useChatContext();
    const { cid } = useLocalSearchParams();
    const router = useRouter();
    const [channel, setChannel] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [menuVisible, setMenuVisible] = useState(false);
    const [otherUser, setOtherUser] = useState<any>(null);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {

        const checkBlockStatus = async (userId: string) => {
            try {
                if (!userId || !client) return;

                const blockedUsers = await client.getBlockedUsers();
                const blocked = blockedUsers.blocks?.some((block: any) => block.blocked_user_id === userId);
                setIsBlocked(blocked || false);
            } catch (err) {
                console.error('Error checking block status:', err);
            }
        };

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

                // Get the other user info
                const members = Object.values(channelInstance.state.members || {});
                const otherMember = members.find((member: any) => member.user?.id !== client?.userID);
                setOtherUser(otherMember?.user);

                // Check if user is blocked
                await checkBlockStatus(otherMember?.user?.id as string);

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

    const handleBlockUser = async () => {
        if (!otherUser?.id) return;

        try {
            Alert.alert(
                'Block User',
                `Are you sure you want to block ${otherUser.name || otherUser.id}? You will no longer receive messages from this user in 1-on-1 chats.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Block',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await client.blockUser(otherUser.id);
                                setIsBlocked(true);
                                setMenuVisible(false);

                                // Navigate back to chat list since channel will be hidden
                                router.push('/chat');

                                Alert.alert('User Blocked', `${otherUser.name || otherUser.id} has been blocked.`);
                            } catch (err) {
                                console.error('Error blocking user:', err);
                                Alert.alert('Error', 'Failed to block user. Please try again.');
                            }
                        }
                    }
                ]
            );
        } catch (err) {
            console.error('Error in block user flow:', err);
        }
    };

    const handleUnblockUser = async () => {
        if (!otherUser?.id) return;

        try {
            Alert.alert(
                'Unblock User',
                `Are you sure you want to unblock ${otherUser.name || otherUser.id}? You will start receiving messages from this user again.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Unblock',
                        onPress: async () => {
                            try {
                                await client.unBlockUser(otherUser.id);
                                setIsBlocked(false);
                                setMenuVisible(false);

                                Alert.alert('User Unblocked', `${otherUser.name || otherUser.id} has been unblocked.`);
                            } catch (err) {
                                console.error('Error unblocking user:', err);
                                Alert.alert('Error', 'Failed to unblock user. Please try again.');
                            }
                        }
                    }
                ]
            );
        } catch (err) {
            console.error('Error in unblock user flow:', err);
        }
    };

    const getChannelTitle = () => {
        if (!channel) return 'Chat';
        return otherUser?.name || otherUser?.id || 'Chat';
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <Appbar.Header style={styles.header}>
                    <Appbar.BackAction
                        iconColor="#fff"
                        onPress={() => router.push('/chat')}
                    />
                    <Appbar.Content title="Loading..." titleStyle={styles.headerTitle} />
                </Appbar.Header>
                <View style={styles.centerContent}>
                    <Text style={styles.loadingText}>Loading channel...</Text>
                </View>
            </View>
        );
    }

    if (error || !channel) {
        return (
            <View style={styles.container}>
                <Appbar.Header style={styles.header}>
                    <Appbar.BackAction
                        iconColor="#fff"
                        onPress={() => router.push('/chat')}
                    />
                    <Appbar.Content title="Error" titleStyle={styles.headerTitle} />
                </Appbar.Header>
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>{error || 'Channel not found'}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Appbar.Header style={styles.header}>
                <Appbar.BackAction
                    iconColor="#fff"
                    onPress={() => router.push('/chat')}
                />
                <Appbar.Content
                    title={getChannelTitle()}
                    titleStyle={styles.headerTitle}
                />
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    contentStyle={styles.menuContent}
                    anchor={
                        <Appbar.Action
                            icon="dots-vertical"
                            iconColor="#fff"
                            onPress={() => setMenuVisible(true)}
                        />
                    }
                >
                    {isBlocked ? (
                        <Menu.Item
                            onPress={handleUnblockUser}
                            title="Unblock User"
                            titleStyle={styles.menuItemText}
                            leadingIcon="account-check"
                        />
                    ) : (
                        <Menu.Item
                            onPress={handleBlockUser}
                            title="Block User"
                            titleStyle={[styles.menuItemText, styles.destructiveText]}
                            leadingIcon="account-cancel"
                        />
                    )}
                </Menu>
            </Appbar.Header>

            <View style={styles.chatContainer}>
                <Channel channel={channel}>
                    <MessageList />
                    <MessageInput />
                </Channel>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DARK_BG,
    },
    header: {
        backgroundColor: DARK_BG,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    chatContainer: {
        flex: 1,
    },
    centerContent: {
        flex: 1,
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
    menuContent: {
        backgroundColor: '#27272a',
        borderRadius: 8,
    },
    menuItemText: {
        color: '#ffffff',
    },
    destructiveText: {
        color: '#ef4444',
    },
});