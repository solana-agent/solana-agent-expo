import React, { useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { IconButton } from "react-native-paper";
import { useChatContext } from "stream-chat-expo";
import { chatUserId } from "../config/chatConfig";

const DARK_BG = "#18181b";

export const UserSearch = ({ onUserSelect, onClose }: {
    onUserSelect: (userId: string) => void;
    onClose: () => void;
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { client } = useChatContext();

    const searchUsers = async (query: string) => {
        if (query.length > 0) {
            setLoading(true);
            try {
                const response = await client.queryUsers(
                    {
                        $or: [
                            { name: { $autocomplete: query } },
                            { id: { $autocomplete: query } },
                        ],
                    },
                    { id: 1 },
                    { limit: 20 }
                );

                // Filter out current user from results
                const filteredUsers = response.users.filter(user => user.id !== chatUserId);
                setUsers(filteredUsers);
            } catch (error) {
                console.error("Error searching users:", error);
                setUsers([]);
            }
            setLoading(false);
        } else {
            setUsers([]);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>New Chat</Text>
                <IconButton
                    icon="close"
                    iconColor="#fff"
                    onPress={onClose}
                />
            </View>

            <TextInput
                style={styles.searchInput}
                placeholder="Search users by name or ID..."
                placeholderTextColor="#a3a3a3"
                value={searchQuery}
                onChangeText={(text) => {
                    setSearchQuery(text);
                    searchUsers(text);
                }}
                autoFocus
            />

            {loading && (
                <Text style={styles.loadingText}>Searching...</Text>
            )}

            <FlatList
                data={users}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.userItem}
                        onPress={() => onUserSelect(item.id)}
                    >
                        <View style={styles.userAvatar}>
                            <Text style={styles.userAvatarText}>
                                {(item.name || item.id).charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>
                                {item.name || item.id}
                            </Text>
                            <Text style={styles.userId}>
                                @{item.id}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    searchQuery.length > 0 && !loading ? (
                        <Text style={styles.emptyText}>No users found</Text>
                    ) : null
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DARK_BG,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    searchInput: {
        backgroundColor: '#1e1e1e',
        color: '#fff',
        padding: 15,
        margin: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
    },
    loadingText: {
        color: '#a3a3a3',
        textAlign: 'center',
        marginTop: 20,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    userAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    userAvatarText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    userId: {
        color: '#a3a3a3',
        fontSize: 14,
    },
    emptyText: {
        color: '#a3a3a3',
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
    },
});
