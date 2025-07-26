import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Channel,
    MessageList,
    MessageInput,
    useChatContext,
} from 'stream-chat-expo';
import { Appbar, Menu } from 'react-native-paper';
import { useAppStore } from '../store/Store';

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
        setError('');
        setLoading(true);
        const loadChannel = async () => {
            try {
                if (!client || !cid) {
                    setError('No chat client or channel ID');
                    setLoading(false);
                    return;
                }

                console.log('Loading channel with CID:', cid);

                // Get the channel
                const rawCid = Array.isArray(cid) ? cid[0] : cid;
                const channelId = typeof rawCid === 'string' && rawCid.includes(':') ? rawCid.split(':')[1] : rawCid;
                const channelInstance = client.channel('messaging', channelId);
                await channelInstance.watch();

                setChannel(channelInstance);

                // Get other user info (assuming it's a 1:1 chat)
                const members = Object.values(channelInstance.state.members || {});
                const currentUser = client.userID;
                const otherMember = members.find((member: any) => member.user?.id !== currentUser);

                if (otherMember?.user) {
                    setOtherUser(otherMember.user);

                    // Check if user is blocked
                    const currentUserData = await client.queryUsers({ id: currentUser });
                    if (currentUserData.users && currentUserData.users[0]) {
                        const blockedUsers = currentUserData.users[0].blocked_user_ids || [];
                        setIsBlocked(blockedUsers.includes(otherMember.user.id));
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error('Error loading channel:', err);
                setError('Failed to load channel');
                setLoading(false);
            }
        };

        loadChannel();
    }, [client, cid]);

    const handleBlockUser = async () => {
        if (!otherUser || !client) return;

        try {
            if (isBlocked) {
                // Unblock user
                await client.unBlockUser(otherUser.id);
                setIsBlocked(false);
                Alert.alert('Success', `${otherUser.name || otherUser.id} has been unblocked`);
            } else {
                // Block user
                await client.blockUser(otherUser.id);
                setIsBlocked(true);
                Alert.alert('Success', `${otherUser.name || otherUser.id} has been blocked`);
            }
        } catch (error) {
            console.error('Error blocking/unblocking user:', error);
            Alert.alert('Error', 'Failed to update block status');
        }
        setMenuVisible(false);
    };

    const showBlockConfirmation = () => {
        const action = isBlocked ? 'unblock' : 'block';
        const userName = otherUser?.name || otherUser?.id || 'this user';

        Alert.alert(
            `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
            `Are you sure you want to ${action} ${userName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: action.charAt(0).toUpperCase() + action.slice(1),
                    onPress: handleBlockUser,
                    style: isBlocked ? 'default' : 'destructive'
                }
            ]
        );
        setMenuVisible(false);
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
                    <Text style={{ color: "#fff" }}>Loading channel...</Text>
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
                    title={otherUser?.name || otherUser?.id || 'Chat'}
                    titleStyle={styles.headerTitle}
                />
                <Menu
                    visible={menuVisible}
                    onDismiss={() => setMenuVisible(false)}
                    anchor={
                        <Appbar.Action
                            icon="dots-vertical"
                            iconColor="#fff"
                            onPress={() => setMenuVisible(true)}
                        />
                    }
                    contentStyle={styles.menuContent}
                >
                    <Menu.Item
                        onPress={showBlockConfirmation}
                        title={isBlocked ? 'Unblock User' : 'Block User'}
                        titleStyle={styles.menuItemText}
                        leadingIcon={isBlocked ? 'account-check' : 'account-cancel'}
                    />
                </Menu>
            </Appbar.Header>
            {/* Make Channel fill the rest of the space */}
            <View style={{ flex: 1 }}>
                <Channel
                    channel={channel}
                    shouldShowUnreadUnderlay={false}
                >
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
        borderBottomColor: "#3f3f46",
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: '#f87171',
        fontSize: 16,
        textAlign: 'center',
    },
    menuContent: {
        backgroundColor: "#27272a",
        borderRadius: 8,
    },
    menuItemText: {
        color: "#fff",
    },
});
