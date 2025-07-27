import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView, FlatList, Linking } from 'react-native';
import { Text, Appbar, TextInput, Button, Menu, ActivityIndicator, SegmentedButtons, Card, IconButton, List } from 'react-native-paper';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppStore } from './store/Store';
import Constants from 'expo-constants';
import { usePrivy } from '@privy-io/expo';
import { Swipeable } from 'react-native-gesture-handler';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

const DARK_BG = "#18181b";
const DARK_CARD = "#27272a";
const DARK_BORDER = "#3f3f46";

// Add types for payment requests
interface PaymentRequest {
    id: string;
    amount: number;
    payee: string;
    payer: string;
    dueDate: number;
    status: string;
    type: string; // 'AR' or 'AP'
    externalId?: string;
    memo?: string;
    createdAt: string;
    link: string;
    attachments?: { id?: string; filename?: string; url?: string; size?: number }[];
    fee_percent: number;
    fee_total: number;
}

// Add these interfaces near the top with your existing interfaces
interface MonthlyMetrics {
    revenue: number; // AR - money coming in (you're receiving)
    expenses: number; // AP - money going out (you're paying)
    cashFlow: number; // revenue - expenses
}

// Add this function to calculate metrics from payment requests
const calculateMonthlyMetrics = (requests: PaymentRequest[]): MonthlyMetrics => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Filter requests for current month
    const currentMonthRequests = requests.filter(request => {
        const requestDate = new Date(request.dueDate * 1000);
        return requestDate.getMonth() === currentMonth &&
            requestDate.getFullYear() === currentYear;
    });

    let revenue = 0; // Money coming to you (AR)
    let expenses = 0; // Money going from you (AP)

    currentMonthRequests.forEach(request => {
        // Convert all amounts to USD for simplification
        // In a real app, you'd use actual exchange rates
        let amount = request.amount;

        if (request.type === 'AR') {
            // Accounts Receivable - money coming to you
            if (request.status === 'paid') {
                revenue += amount;
            }
        } else {
            // Accounts Payable - money you need to pay
            if (request.status === 'paid') {
                expenses += amount;
            }
        }
    });

    return {
        revenue,
        expenses,
        cashFlow: revenue - expenses,
    };
};

function getStatusColor(status: string): string {
    switch (status) {
        case 'paid': return '#10b981';
        case 'accepted': return '#3b82f6';
        case 'rejected': return '#ef4444';
        case 'expired': return '#6b7280';
        case 'outstanding': return '#f59e0b';
        default: return '#6b7280';
    }
}

function getStatusIcon(status: string): string {
    switch (status) {
        case 'paid': return 'check-circle';
        case 'accepted': return 'clock-check';
        case 'rejected': return 'close-circle';
        case 'expired': return 'clock-alert';
        case 'outstanding': return 'clock';
        default: return 'clock';
    }
}

function PayerSearch({ onSelect, onClose }: { onSelect: (user: any) => void, onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const { getAccessToken } = usePrivy();

    const searchUsers = async (text: string) => {
        setLoading(true);
        setQuery(text);
        try {
            const accessToken = await getAccessToken();
            if (!accessToken) return;
            const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(text)}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setResults(data.users || []);
            }
        } catch (error) {
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (query.length > 0) {
            searchUsers(query);
        } else {
            setResults([]);
        }
    }, [query]);

    return (
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search by username or display name"
                    autoFocus
                />
                <IconButton icon="close" onPress={onClose} />
            </View>
            {loading ? (
                <ActivityIndicator color="#3b82f6" />
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.selectedUser}
                            onPress={() => onSelect(item)}
                        >
                            <Text style={styles.selectedUserText}>
                                {item.name || item.username}
                            </Text>
                            <Icon name="check" size={20} color="#10b981" />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <Text style={{ color: '#a1a1aa', textAlign: 'center', marginTop: 16 }}>
                            {query ? 'No users found.' : 'Type to search for users.'}
                        </Text>
                    }
                />
            )}
        </View>
    );
}


export default function PaymentLinksScreen() {
    const router = useRouter();
    const { username, preferredCurrency } = useAppStore();
    const { getAccessToken } = usePrivy();

    // Tab state
    const [selectedTab, setSelectedTab] = useState('create');

    // Form state (for Create tab)
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState(new Date());
    const [externalId, setExternalId] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
    const [generatedLink, setGeneratedLink] = useState('');
    const [memo, setMemo] = useState('');

    // Created links state
    const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);

    // UI state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [loading, setLoading] = useState(false);
    const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyMetrics>({
        revenue: 0,
        expenses: 0,
        cashFlow: 0,
    });
    const [formExpanded, setFormExpanded] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);

    // pagination
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [hasMore, setHasMore] = useState(true);

    // Reset pagination when switching to "created" tab
    useEffect(() => {
        if (selectedTab === 'created') {
            setPage(1);
            setHasMore(true);
            loadPaymentRequests(1);
        }
    }, [selectedTab]);

    // Handler for FlatList's onEndReached
    const handleLoadMore = () => {
        if (!loadingRequests && hasMore) {
            loadPaymentRequests(page + 1);
        }
    };

    // Load payment requests when switching to Created tab
    useEffect(() => {
        if (selectedTab === 'created') {
            loadPaymentRequests();
        }
    }, [selectedTab]);

    const loadPaymentRequests = async (pageToLoad = 1) => {
        try {
            setLoadingRequests(true);
            const accessToken = await getAccessToken();
            if (!accessToken) return;

            const response = await fetch(
                `${API_URL}/payment/requests?page=${pageToLoad}&page_size=${pageSize}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                const requests = data.requests || [];

                if (pageToLoad === 1) {
                    setPaymentRequests(requests);
                } else {
                    // Avoid duplicates by id
                    setPaymentRequests(prev => {
                        const ids = new Set(prev.map(r => r.id));
                        const newRequests = requests.filter((r: any) => !ids.has(r.id));
                        return [...prev, ...newRequests];
                    });
                }

                setHasMore(requests.length === pageSize);
                setPage(pageToLoad);

                // Metrics only on first page
                if (pageToLoad === 1 && data.metrics) {
                    setMonthlyMetrics({
                        revenue: data.metrics.revenue,
                        expenses: data.metrics.expenses,
                        cashFlow: data.metrics.cashFlow,
                    });
                } else if (pageToLoad === 1) {
                    const metrics = calculateMonthlyMetrics(requests);
                    setMonthlyMetrics({ ...metrics });
                }
            }
        } catch (error) {
            console.error('Error loading payment requests:', error);
        } finally {
            setLoadingRequests(false);
        }
    };

    const MetricsCard = ({ title, amount, color, icon, token }: {
        title: string;
        amount: number;
        color: string;
        icon: string;
        token: string;
    }) => (
        <View style={[styles.metricCard, { borderLeftColor: color }]}>
            <View style={styles.metricHeader}>
                <Icon name={icon} size={20} color={color} />
                <Text style={styles.metricTitle}>{title}</Text>
            </View>
            <Text style={[styles.metricAmount, { color }]}>
                {Math.abs(amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })} {token}
            </Text>
        </View>
    );

    const handleUserSelect = (user: any) => {
        setSelectedUser(user);
        setShowUserSearch(false);
    };

    const handleAmountChange = (value: string) => {
        setAmount(value);
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setDueDate(selectedDate);
        }
    };

    const handleTimeChange = (event: any, selectedTime?: Date) => {
        setShowTimePicker(false);
        if (selectedTime) {
            const newDate = new Date(dueDate);
            newDate.setHours(selectedTime.getHours());
            newDate.setMinutes(selectedTime.getMinutes());
            setDueDate(newDate);
        }
    };

    const handleFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                const file = result.assets[0];

                // Double-check the file type (extra validation)
                if (file.mimeType !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
                    Alert.alert('Invalid File Type', 'Only PDF files are supported.');
                    return;
                }

                // On Android, file.size is always available
                setAttachedFiles([...attachedFiles, file]);
            }
        } catch (error) {
            console.error('Error picking document:', error);
            Alert.alert('Error', 'Failed to pick document');
        }
    };

    const removeFile = (index: number) => {
        setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
    };

    const generatePaymentLink = async () => {
        if (!selectedUser || !amount) {
            Alert.alert('Missing Information', 'Please fill in all required fields');
            return;
        }

        setLoading(true);

        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                throw new Error('No access token available');
            }

            let response;
            const formData = new FormData();

            formData.append('payer', selectedUser.id);
            formData.append('payee', username);
            formData.append('amount', amount);
            formData.append('token', 'USDC'); // Assuming USDC is the only token for now
            formData.append('dueDate', Math.floor(dueDate.getTime() / 1000).toString());

            if (memo) {
                formData.append('memo', memo);
            } else {
                formData.append('memo', `Payment request from ${username} to ${selectedUser.name || selectedUser.id}`);
            }

            if (externalId) {
                formData.append('externalId', externalId);
            }

            attachedFiles.forEach((file, index) => {
                formData.append(`attachments`, {
                    uri: file.uri,
                    type: file.mimeType || 'application/pdf',
                    name: file.name || `attachment_${index}`,
                } as any);
            });

            response = await fetch(`${API_URL}/payment/create-request`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create payment request');
            }

            const result = await response.json();

            const markdownLink = `[Pay now](agent://pay?id=${result.id})`;
            setGeneratedLink(markdownLink);

            // Clear all form fields except the generated link
            setSelectedUser(null);
            setAmount('');
            setMemo('');
            setDueDate(new Date());
            setExternalId('');
            setAttachedFiles([]);

            // Collapse the form and scroll to the link
            setFormExpanded(false);
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 350);

            Alert.alert('Success', 'Payment request created successfully!');

            if (selectedTab === 'created') {
                loadPaymentRequests();
            }

        } catch (error) {
            console.error('Error creating payment request:', error);
            Alert.alert('Error', 'Failed to create payment request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelRequest = async (item: PaymentRequest) => {
        Alert.alert(
            'Cancel Payment Request',
            'Are you sure you want to cancel this payment request?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Cancel Request',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoadingRequests(true);
                            const accessToken = await getAccessToken();
                            if (!accessToken) throw new Error('No access token available');
                            const response = await fetch(`${API_URL}/payment/request/${item.id}/cancel`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`,
                                    'Content-Type': 'application/json',
                                },
                            });
                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || 'Failed to cancel payment request');
                            }
                            Alert.alert('Request Cancelled', 'The payment request has been cancelled.');
                            loadPaymentRequests();
                        } catch (error) {
                            console.error('Error cancelling payment request:', error);
                            Alert.alert('Error', `Failed to cancel payment request: ${error}`);
                        } finally {
                            setLoadingRequests(false);
                        }
                    }
                }
            ]
        );
    };

    const handleAcceptPayment = async (item: PaymentRequest) => {
        try {
            setLoadingRequests(true);
            const accessToken = await getAccessToken();
            if (!accessToken) throw new Error('No access token available');

            const response = await fetch(`${API_URL}/payment/request/${item.id}/accept`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to accept payment request');
            }

            Alert.alert('Success', 'Payment request accepted! The payment will be processed.');
            loadPaymentRequests();
        } catch (error) {
            console.error('Error accepting payment request:', error);
            Alert.alert('Error', `Failed to accept payment request: ${error}`);
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleDenyPayment = async (item: PaymentRequest) => {
        Alert.alert(
            'Deny Payment Request',
            'Are you sure you want to deny this payment request?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Deny',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoadingRequests(true);
                            const accessToken = await getAccessToken();
                            if (!accessToken) throw new Error('No access token available');

                            const response = await fetch(`${API_URL}/payment/request/${item.id}/deny`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${accessToken}`,
                                    'Content-Type': 'application/json',
                                },
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || 'Failed to deny payment request');
                            }

                            Alert.alert('Payment Denied', 'The payment request has been denied.');
                            loadPaymentRequests();
                        } catch (error) {
                            console.error('Error denying payment request:', error);
                            Alert.alert('Error', `Failed to deny payment request: ${error}`);
                        } finally {
                            setLoadingRequests(false);
                        }
                    }
                }
            ]
        );
    };

    // Swipe actions for each card
    const renderRightActions = (item: PaymentRequest) => {
        // Only show Accept/Deny for payer, Cancel for payee, only if outstanding
        if (item.status !== 'outstanding') return null;

        if (item.payer === username) {
            return (
                <View style={{ flexDirection: 'row', height: '100%' }}>
                    <TouchableOpacity
                        style={{
                            backgroundColor: '#10b981',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: 80,
                        }}
                        onPress={() => handleAcceptPayment(item)}
                    >
                        <Icon name="check" size={28} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{
                            backgroundColor: '#ef4444',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: 80,
                        }}
                        onPress={() => handleDenyPayment(item)}
                    >
                        <Icon name="close" size={28} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Deny</Text>
                    </TouchableOpacity>
                </View>
            );
        } else if (item.payee === username) {
            return (
                <View style={{ flexDirection: 'row', height: '100%' }}>
                    <TouchableOpacity
                        style={{
                            backgroundColor: '#ef4444',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: 80,
                        }}
                        onPress={() => handleCancelRequest(item)}
                    >
                        <Icon name="cancel" size={28} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    };

    // In your copyLink function:
    const copyLink = async () => {
        if (generatedLink) {
            await Clipboard.setStringAsync(generatedLink);
            Alert.alert('Copied!', 'Payment link copied to clipboard');
        }
    };

    const resetForm = () => {
        setSelectedUser(null);
        setAmount('');
        setDueDate(new Date());
        setExternalId('');
        setAttachedFiles([]);
        setGeneratedLink('');
    };

    const renderPaymentRequestCard = ({ item }: { item: PaymentRequest }) => {
        const isPayer = item.payer === username;
        const isPayee = item.payee === username;

        const cardContent = (
            <Card style={styles.requestCard}>
                <Card.Content>
                    {/* Header: Amount, Type, Status */}
                    <View style={styles.requestHeader}>
                        <View style={styles.requestAmount}>
                            <Text style={styles.amountText}>
                                {item.amount} USDC
                            </Text>
                            <Text style={styles.tokenText}>USDC</Text>
                        </View>
                        <View style={styles.requestBadges}>
                            <View style={[
                                styles.typeBadge,
                                { backgroundColor: item.type === 'AR' ? '#3b82f6' : '#f59e0b' }
                            ]}>
                                <Text style={styles.badgeText}>{item.type}</Text>
                            </View>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: getStatusColor(item.status) }
                            ]}>
                                <Icon name={getStatusIcon(item.status)} size={14} color="#fff" />
                                <Text style={styles.badgeText}>{item.status}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Payee and Payer */}
                    <View style={styles.requestInfo}>
                        <Text style={styles.requestLabel}>Payee: {item.payee}</Text>
                        <Text style={styles.requestLabel}>Payer: {item.payer}</Text>
                        <Text style={styles.requestDate}>
                            Due: {new Date(item.dueDate * 1000).toLocaleDateString()}
                        </Text>
                    </View>

                    {/* Memo/Description */}
                    {item.memo && (
                        <Text style={{ color: '#d1d5db', fontSize: 14, fontStyle: 'italic', marginBottom: 4 }}>
                            {item.memo}
                        </Text>
                    )}

                    {/* External ID */}
                    {item.externalId && (
                        <Text style={styles.externalId}>ID: {item.externalId}</Text>
                    )}

                    {/* Attachments */}
                    {item.attachments && item.attachments.length > 0 && (
                        <View style={styles.attachmentSection}>
                            <Text style={styles.attachmentTitle}>Attachments:</Text>
                            {item.attachments.map((att, idx) => (
                                <TouchableOpacity
                                    key={att.id || idx}
                                    style={styles.attachmentItem}
                                    onPress={() => att.url && Linking.openURL(att.url)}
                                >
                                    <Icon name="file-pdf-box" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                    <Text style={styles.attachmentText} numberOfLines={1}>
                                        {att.filename || 'Attachment'}
                                    </Text>
                                    {att.size ? (
                                        <Text style={styles.attachmentSize}>
                                            {(att.size / (1024 * 1024)).toFixed(1)} MB
                                        </Text>
                                    ) : null}
                                    <Icon name="open-in-new" size={14} color="#a1a1aa" style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Fee info */}
                    {item.fee_percent > 0 && (
                        <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 6 }}>
                            Fee: {item.fee_percent}% ({item.fee_total} USDC)
                        </Text>
                    )}
                </Card.Content>
            </Card>
        );

        if (isPayer || isPayee) {
            return (
                <Swipeable renderRightActions={() => renderRightActions(item)}>
                    {cardContent}
                </Swipeable>
            );
        }
        return cardContent;
    };

    return (
        <View style={styles.container}>
            <Appbar.Header style={styles.header}>
                <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
                <Appbar.Content title="Payment Links" titleStyle={styles.headerTitle} />
                {generatedLink && selectedTab === 'create' && (
                    <Appbar.Action icon="refresh" iconColor="#fff" onPress={resetForm} />
                )}
                {selectedTab === 'created' && (
                    <Appbar.Action icon="refresh" iconColor="#fff" onPress={() => loadPaymentRequests(1)} />
                )}
            </Appbar.Header>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
                <SegmentedButtons
                    value={selectedTab}
                    onValueChange={setSelectedTab}
                    buttons={[
                        {
                            value: 'create',
                            label: 'Create',
                            icon: 'plus',
                        },
                        {
                            value: 'created',
                            label: 'Track',
                            icon: 'format-list-bulleted',
                        },
                    ]}
                    style={styles.segmentedButtons}
                    theme={{
                        colors: {
                            secondaryContainer: '#6d28d9',
                            onSecondaryContainer: '#ffffff',
                            outline: DARK_BORDER,
                        },
                    }}
                />
            </View>

            {/* Tab Content */}
            {selectedTab === 'create' ? (
                showUserSearch ? (
                    <View style={[styles.content, { flex: 1 }]}>
                        <Text style={styles.sectionTitle}>Select Payer</Text>
                        <PayerSearch onSelect={handleUserSelect} onClose={() => setShowUserSearch(false)} />
                    </View>
                ) : (
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.content}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.contentContainerWithTabBar}
                    >
                        <List.Accordion
                            title="Create Payment Link"
                            expanded={formExpanded}
                            onPress={() => setFormExpanded(!formExpanded)}
                            left={props => <List.Icon {...props} icon="form-select" color="#3b82f6" />}
                            style={styles.metricsAccordion}
                            theme={{ colors: { background: DARK_CARD } }}
                        >
                            {/* Payer Selection */}
                            <View style={styles.section}>
                                <Text style={styles.label}>From (Payer) *</Text>
                                {selectedUser ? (
                                    <TouchableOpacity
                                        style={styles.selectedUser}
                                        onPress={() => setShowUserSearch(true)}
                                    >
                                        <Text style={styles.selectedUserText}>
                                            {selectedUser.name || selectedUser.id}
                                        </Text>
                                        <Icon name="pencil" size={20} color="#a1a1aa" />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.selectButton}
                                        onPress={() => setShowUserSearch(true)}
                                    >
                                        <Text style={styles.selectButtonText}>Select Payer</Text>
                                        <Icon name="chevron-right" size={20} color="#a1a1aa" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Amount Input */}
                            <View style={styles.section}>
                                <Text style={styles.label}>Amount *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={amount}
                                    onChangeText={handleAmountChange}
                                    placeholder="0.00"
                                    keyboardType="decimal-pad"
                                    mode="outlined"
                                    theme={{
                                        colors: {
                                            primary: '#3b82f6',
                                            background: DARK_CARD,
                                            surface: DARK_CARD,
                                            outline: DARK_BORDER,
                                            onSurface: '#ffffff',
                                            placeholder: '#a1a1aa',
                                        },
                                    }}
                                />
                            </View>

                            {/* Due Date */}
                            <View style={styles.section}>
                                <Text style={styles.label}>Due Date *</Text>
                                <View style={styles.dateTimeContainer}>
                                    <TouchableOpacity
                                        style={[styles.dropdown, { flex: 1, marginRight: 8 }]}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={styles.dropdownText}>
                                            {dueDate.toLocaleDateString()}
                                        </Text>
                                        <Icon name="calendar" size={20} color="#a1a1aa" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.dropdown, { flex: 1 }]}
                                        onPress={() => setShowTimePicker(true)}
                                    >
                                        <Text style={styles.dropdownText}>
                                            {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                        <Icon name="clock" size={20} color="#a1a1aa" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Description (Memo) */}
                            <View style={styles.section}>
                                <Text style={styles.label}>Description</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={memo}
                                    onChangeText={setMemo}
                                    placeholder="What is this invoice for?"
                                    mode="outlined"
                                    theme={{
                                        colors: {
                                            primary: '#3b82f6',
                                            background: DARK_CARD,
                                            surface: DARK_CARD,
                                            outline: DARK_BORDER,
                                            onSurface: '#ffffff',
                                            placeholder: '#a1a1aa',
                                        },
                                    }}
                                />
                            </View>

                            {/* External ID */}
                            <View style={styles.section}>
                                <Text style={styles.label}>External ID</Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={externalId}
                                    onChangeText={setExternalId}
                                    placeholder="Optional reference ID"
                                    mode="outlined"
                                    theme={{
                                        colors: {
                                            primary: '#3b82f6',
                                            background: DARK_CARD,
                                            surface: DARK_CARD,
                                            outline: DARK_BORDER,
                                            onSurface: '#ffffff',
                                            placeholder: '#a1a1aa',
                                        },
                                    }}
                                />
                            </View>

                            {/* File Attachments */}
                            <View style={styles.section}>
                                <Text style={styles.label}>Attachments</Text>
                                <TouchableOpacity style={styles.uploadButton} onPress={handleFileUpload}>
                                    <Icon name="file-pdf-box" size={20} color="#3b82f6" />
                                    <Text style={styles.uploadButtonText}>Attach PDF (max 100MB)</Text>
                                </TouchableOpacity>

                                {attachedFiles.map((file, index) => (
                                    <View key={index} style={styles.fileItem}>
                                        <Icon name="file-pdf-box" size={16} color="#ef4444" />
                                        <View style={styles.fileInfo}>
                                            <Text style={styles.fileName}>{file.name}</Text>
                                            <Text style={styles.fileSize}>
                                                {file.size && file.size > 0
                                                    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                                                    : 'Size unknown'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => removeFile(index)}>
                                            <Icon name="close" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>

                            {/* Generate Link Button */}
                            <View style={styles.section}>
                                <Button
                                    mode="contained"
                                    onPress={generatePaymentLink}
                                    loading={loading}
                                    disabled={loading || !selectedUser || !amount}
                                    style={styles.generateButton}
                                    labelStyle={styles.generateButtonText}
                                >
                                    Generate Payment Link
                                </Button>
                            </View>
                        </List.Accordion>

                        {/* Generated Link */}
                        {generatedLink && (
                            <View style={styles.section}>
                                <Text style={styles.label}>Payment Link</Text>
                                <View style={styles.linkContainer}>
                                    <Text style={styles.linkText}>{generatedLink}</Text>
                                    <TouchableOpacity style={styles.copyButton} onPress={copyLink}>
                                        <Icon name="content-copy" size={20} color="#3b82f6" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                )
            ) : (
                <FlatList
                    data={paymentRequests}
                    renderItem={renderPaymentRequestCard}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContainer}
                    ListHeaderComponent={
                        <View style={styles.metricsSection}>
                            <List.Accordion
                                title="This Month's Metrics"
                                titleStyle={[styles.metricsTitle, { alignSelf: 'center', paddingVertical: 0 }]}
                                style={[styles.metricsAccordion, { paddingVertical: 0, minHeight: 48 }]}
                                left={props => (
                                    <List.Icon {...props} icon="chart-bar" color="#3b82f6" style={{ marginLeft: 16, alignSelf: 'center' }} />
                                )}
                                theme={{ colors: { background: DARK_CARD } }}
                            >
                                <View style={styles.metricsAccordionContent}>
                                    <View style={styles.metricsGrid}>
                                        <MetricsCard
                                            title="Revenue (AR)"
                                            amount={monthlyMetrics.revenue}
                                            color="#10b981"
                                            icon="trending-up"
                                            token="USDC"
                                        />
                                        <MetricsCard
                                            title="Expenses (AP)"
                                            amount={monthlyMetrics.expenses}
                                            color="#ef4444"
                                            icon="trending-down"
                                            token="USDC"
                                        />
                                        <MetricsCard
                                            title="Cash Flow"
                                            amount={monthlyMetrics.cashFlow}
                                            color={monthlyMetrics.cashFlow >= 0 ? "#10b981" : "#ef4444"}
                                            icon={monthlyMetrics.cashFlow >= 0 ? "cash-plus" : "cash-minus"}
                                            token="USDC"
                                        />
                                    </View>
                                </View>
                            </List.Accordion>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.centerContent}>
                            <Icon name="receipt" size={64} color="#6b7280" />
                            <Text style={styles.emptyText}>No payment requests yet</Text>
                            <Text style={styles.emptySubtext}>Create your first payment link to get started</Text>
                        </View>
                    }
                    ListFooterComponent={
                        loadingRequests && hasMore ? (
                            <View style={{ padding: 16 }}>
                                <ActivityIndicator color="#3b82f6" />
                            </View>
                        ) : (
                            <View style={{ height: 48 }} />
                        )
                    }
                    refreshing={loadingRequests && page === 1}
                    onRefresh={() => {
                        setPage(1);
                        setHasMore(true);
                        loadPaymentRequests(1);
                    }}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                />
            )}

            {/* Date/Time Pickers */}
            {showDatePicker && (
                <DateTimePicker
                    value={dueDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                />
            )}

            {showTimePicker && (
                <DateTimePicker
                    value={dueDate}
                    mode="time"
                    display="default"
                    onChange={handleTimeChange}
                />
            )}
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
        borderBottomColor: DARK_BORDER,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    tabContainer: {
        padding: 16,
        paddingBottom: 8,
    },
    segmentedButtons: {
        backgroundColor: DARK_CARD,
    },
    content: {
        flex: 1,
        padding: 16,
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
    loadingText: {
        color: '#ffffff',
        fontSize: 16,
        marginTop: 12,
    },
    emptyText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '500',
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        color: '#a1a1aa',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    listContainer: {
        paddingBottom: 20,
    },
    requestCard: {
        backgroundColor: DARK_CARD,
        marginBottom: 16,
        borderRadius: 16,
        borderWidth: 0,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
        padding: 0,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    requestAmount: {
        flex: 1,
        justifyContent: 'center',
    },
    amountText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    tokenText: {
        color: '#a1a1aa',
        fontSize: 13,
        marginTop: 2,
        fontWeight: '500',
    },
    requestBadges: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        backgroundColor: '#3b82f6',
        marginRight: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        gap: 4,
    },
    badgeText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'capitalize',
        marginLeft: 4,
    },
    requestInfo: {
        marginBottom: 8,
        marginTop: 2,
        paddingLeft: 2,
    },
    requestLabel: {
        color: '#e5e7eb',
        fontSize: 15,
        marginBottom: 2,
        fontWeight: '500',
    },
    requestDate: {
        color: '#a1a1aa',
        fontSize: 14,
        marginTop: 2,
    },
    externalId: {
        color: '#71717a',
        fontSize: 12,
        fontFamily: 'monospace',
        marginTop: 6,
        marginBottom: 2,
    },
    attachmentSection: {
        marginTop: 10,
        marginBottom: 2,
    },
    attachmentTitle: {
        color: '#a1a1aa',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
    },
    attachmentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#23232b',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 6,
        marginRight: 8,
    },
    attachmentText: {
        flex: 1,
        color: '#3b82f6',
        fontSize: 14,
        textDecorationLine: 'underline',
        fontWeight: '500',
    },
    attachmentSize: {
        color: '#a1a1aa',
        fontSize: 12,
        marginLeft: 8,
    },
    section: {
        marginTop: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        color: '#ffffff',
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: DARK_CARD,
    },
    dropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: DARK_CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DARK_BORDER,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 56,
    },
    dropdownText: {
        color: '#ffffff',
        fontSize: 16,
    },
    menuContent: {
        backgroundColor: DARK_CARD,
        borderRadius: 8,
    },
    menuItemText: {
        color: '#ffffff',
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: DARK_CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DARK_BORDER,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 56,
    },
    selectButtonText: {
        color: '#a1a1aa',
        fontSize: 16,
    },
    selectedUser: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: DARK_CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#3b82f6',
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 56,
    },
    selectedUserText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '500',
    },
    dateTimeContainer: {
        flexDirection: 'row',
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: DARK_CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DARK_BORDER,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 8,
    },
    uploadButtonText: {
        color: '#3b82f6',
        fontSize: 16,
        marginLeft: 8,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: DARK_CARD,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 4,
    },
    fileName: {
        flex: 1,
        color: '#ffffff',
        fontSize: 14,
        marginLeft: 8,
    },
    generateButton: {
        backgroundColor: '#6d28d9',
        paddingVertical: 8,
    },
    generateButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    linkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: DARK_CARD,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DARK_BORDER,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    linkText: {
        flex: 1,
        color: '#ffffff',
        fontSize: 14,
        fontFamily: 'monospace',
    },
    copyButton: {
        padding: 8,
    },
    metricsSection: {
        marginBottom: 20,
        marginTop: 16,
    },
    metricsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    metricsTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
        alignSelf: 'center',
    },
    refreshButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: DARK_CARD,
        borderWidth: 1,
        borderColor: DARK_BORDER,
    },
    metricsGrid: {
        gap: 12,
    },
    metricCard: {
        backgroundColor: DARK_CARD,
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderColor: DARK_BORDER,
        borderWidth: 1,
    },
    metricHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    metricTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#a1a1aa',
        marginLeft: 8,
    },
    metricAmount: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    metricCurrency: {
        fontSize: 12,
        color: '#71717a',
        textTransform: 'uppercase',
    },
    fileInfo: {
        flex: 1,
        marginLeft: 8,
    },
    fileSize: {
        color: '#a1a1aa',
        fontSize: 12,
        marginTop: 2,
    },
    loginMessage: {
        color: "#f87171",
        fontSize: 18,
        fontWeight: "500",
        textAlign: "center",
        marginTop: 24,
        marginHorizontal: 24,
    },
    metricsAccordion: {
        backgroundColor: DARK_CARD,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: DARK_BORDER,
    },
    metricsAccordionContent: {
        padding: 16,
    },
    contentContainerWithTabBar: {
        paddingBottom: 48, // or whatever your tab bar height is
    },
});
