import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { Text, Appbar, TextInput, Button, Menu, ActivityIndicator, SegmentedButtons, Card, IconButton, List } from 'react-native-paper';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppStore } from './store/Store';
import Constants from 'expo-constants';
import { usePrivy } from '@privy-io/expo';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

const DARK_BG = "#18181b";
const DARK_CARD = "#27272a";
const DARK_BORDER = "#3f3f46";

const ALLOWED_FIAT = [
    'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNH', 'COP', 'EUR', 'GBP', 'IDR',
    'INR', 'JPY', 'KRW', 'MXN', 'NOK', 'NZD', 'PEN', 'PHP', 'SEK', 'SGD',
    'TRY', 'TWD', 'USD', 'ZAR',
];

// Add types for payment requests
interface PaymentRequest {
    id: string;
    amount: number;
    currency: string;
    token: string;
    payee: string;
    payer: string;
    dueDate: number;
    status: 'outstanding' | 'accepted' | 'paid' | 'rejected' | 'expired';
    type: 'AR' | 'AP'; // Accounts Receivable (you sent) or Accounts Payable (you received)
    externalId?: string;
    memo?: string;
    createdAt: string;
    link: string;
}

// Add these interfaces near the top with your existing interfaces
interface MonthlyMetrics {
    revenue: number; // AR - money coming in (you're receiving)
    expenses: number; // AP - money going out (you're paying)
    cashFlow: number; // revenue - expenses
    currency: string; // Primary currency for display
}

function getCurrencySymbol(fiat: string | undefined | null): string {
    if (!fiat) return '';
    if (!ALLOWED_FIAT.includes(fiat)) return '';
    switch (fiat) {
        case 'AUD': return '$';
        case 'BRL': return '$';
        case 'CAD': return '$';
        case 'CHF': return 'CHF';
        case 'CLP': return '$';
        case 'CNH': return '¥';
        case 'COP': return '$';
        case 'EUR': return '€';
        case 'GBP': return '£';
        case 'IDR': return 'Rp';
        case 'INR': return '₹';
        case 'JPY': return '¥';
        case 'KRW': return '₩';
        case 'MXN': return '$';
        case 'NOK': return 'kr';
        case 'NZD': return '$';
        case 'PEN': return 'S/';
        case 'PHP': return '₱';
        case 'SEK': return 'kr';
        case 'SGD': return '$';
        case 'TRY': return '₺';
        case 'TWD': return '$';
        case 'USD': return '$';
        case 'ZAR': return 'R';
        default: return '';
    }
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
        currency: 'USD' // Default to USD for now
    };
};

function currencyName(fiat: string): string {
    switch (fiat) {
        case 'AUD': return 'Australian Dollars';
        case 'BRL': return 'Brazilian Reais';
        case 'CAD': return 'Canadian Dollars';
        case 'CHF': return 'Swiss Francs';
        case 'CLP': return 'Chilean Pesos';
        case 'CNH': return 'Chinese Yuan';
        case 'COP': return 'Colombian Pesos';
        case 'EUR': return 'Euros';
        case 'GBP': return 'British Pounds';
        case 'IDR': return 'Indonesian Rupiah';
        case 'INR': return 'Indian Rupees';
        case 'JPY': return 'Japanese Yen';
        case 'KRW': return 'South Korean Won';
        case 'MXN': return 'Mexican Pesos';
        case 'NOK': return 'Norwegian Kroner';
        case 'NZD': return 'New Zealand Dollars';
        case 'PEN': return 'Peruvian Soles';
        case 'PHP': return 'Philippine Pesos';
        case 'SEK': return 'Swedish Kronor';
        case 'SGD': return 'Singapore Dollars';
        case 'TRY': return 'Turkish Lira';
        case 'TWD': return 'New Taiwan Dollars';
        case 'USD': return 'United States Dollars';
        case 'ZAR': return 'South African Rand';
        default: return '';
    }
}

function formatCurrency(value: string, currency: string): string {
    // Remove non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');

    // Prevent multiple decimal points
    const parts = numericValue.split('.');
    if (parts.length > 2) {
        return parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
        return parts[0] + '.' + parts[1].substring(0, 2);
    }

    return numericValue;
}

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

function PayeeSearch({ onSelect, onClose }: { onSelect: (user: any) => void, onClose: () => void }) {
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
    const [currency, setCurrency] = useState('USD');
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('USDC');
    const [dueDate, setDueDate] = useState(new Date());
    const [externalId, setExternalId] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
    const [generatedLink, setGeneratedLink] = useState('');

    // Created links state
    const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(false);

    // UI state
    const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
    const [tokenMenuVisible, setTokenMenuVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [loading, setLoading] = useState(false);
    const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyMetrics>({
        revenue: 0,
        expenses: 0,
        cashFlow: 0,
        currency: preferredCurrency || 'USD' // Use preferred currency
    });
    const [formExpanded, setFormExpanded] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);


    // Load payment requests when switching to Created tab
    useEffect(() => {
        if (selectedTab === 'created') {
            loadPaymentRequests();
        }
    }, [selectedTab]);

    // Update token when currency changes
    useEffect(() => {
        if (currency === 'EUR') {
            setToken('EURC');
        } else if (currency === 'USD') {
            setToken('USDC');
        }
        // For other currencies, keep the current token selection (don't auto-change)
    }, [currency]);

    // Update the loadPaymentRequests function to calculate metrics
    // Update the loadPaymentRequests function to use preferred currency in API call
    const loadPaymentRequests = async () => {
        try {
            setLoadingRequests(true);
            const accessToken = await getAccessToken();
            if (!accessToken) return;

            // Add currency parameter to the API request
            const response = await fetch(`${API_URL}/payment/requests?currency=${preferredCurrency}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                const requests = data.requests || [];
                setPaymentRequests(requests);

                // The API should now return metrics already converted to preferred currency
                if (data.metrics) {
                    setMonthlyMetrics({
                        revenue: data.metrics.revenue,
                        expenses: data.metrics.expenses,
                        cashFlow: data.metrics.cashFlow,
                        currency: preferredCurrency
                    });
                } else {
                    // Fallback: calculate metrics locally (but amounts won't be converted)
                    const metrics = calculateMonthlyMetrics(requests);
                    setMonthlyMetrics({
                        ...metrics,
                        currency: preferredCurrency
                    });
                }
            }
        } catch (error) {
            console.error('Error loading payment requests:', error);
        } finally {
            setLoadingRequests(false);
        }
    };

    const MetricsCard = ({ title, amount, currency, color, icon }: {
        title: string;
        amount: number;
        currency: string;
        color: string;
        icon: string;
    }) => (
        <View style={[styles.metricCard, { borderLeftColor: color }]}>
            <View style={styles.metricHeader}>
                <Icon name={icon} size={20} color={color} />
                <Text style={styles.metricTitle}>{title}</Text>
            </View>
            <Text style={[styles.metricAmount, { color }]}>
                {getCurrencySymbol(currency)}{Math.abs(amount).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}
            </Text>
            <Text style={styles.metricCurrency}>{currency}</Text>
        </View>
    );

    const handleUserSelect = (user: any) => {
        setSelectedUser(user);
        setShowUserSearch(false);
    };

    const handleAmountChange = (value: string) => {
        const formatted = formatCurrency(value, currency);
        setAmount(formatted);
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
        if (!selectedUser || !amount || !currency) {
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

            formData.append('payee', selectedUser.id);
            formData.append('payer', username);
            formData.append('amount', amount);
            formData.append('currency', currency);
            formData.append('token', token);
            formData.append('dueDate', Math.floor(dueDate.getTime() / 1000).toString());

            if (externalId) {
                formData.append('externalId', externalId);
            }

            formData.append('memo', `Payment request from ${username} to ${selectedUser.name || selectedUser.id}`);

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

    // In your copyLink function:
    const copyLink = async () => {
        if (generatedLink) {
            await Clipboard.setStringAsync(generatedLink);
            Alert.alert('Copied!', 'Payment link copied to clipboard');
        }
    };

    const resetForm = () => {
        setSelectedUser(null);
        setCurrency('USD');
        setAmount('');
        setToken('USDC');
        setDueDate(new Date());
        setExternalId('');
        setAttachedFiles([]);
        setGeneratedLink('');
    };

    const handleRequestPress = (request: PaymentRequest) => {
        // Navigate to detailed view - you can create this later
        Alert.alert(
            'Payment Request Details',
            `Amount: ${request.amount} ${request.currency}\nStatus: ${request.status}\nType: ${request.type}\nDue: ${new Date(request.dueDate * 1000).toLocaleDateString()}`
        );
    };

    const renderPaymentRequestCard = ({ item }: { item: PaymentRequest }) => (
        <TouchableOpacity onPress={() => handleRequestPress(item)}>
            <Card style={styles.requestCard}>
                <Card.Content>
                    <View style={styles.requestHeader}>
                        <View style={styles.requestAmount}>
                            <Text style={styles.amountText}>
                                {item.amount} {item.currency}
                            </Text>
                            <Text style={styles.tokenText}>{item.token}</Text>
                        </View>
                        <View style={styles.requestBadges}>
                            <View style={[styles.typeBadge, { backgroundColor: item.type === 'AR' ? '#3b82f6' : '#f59e0b' }]}>
                                <Text style={styles.badgeText}>{item.type}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                                <Icon name={getStatusIcon(item.status)} size={12} color="#fff" />
                                <Text style={styles.badgeText}>{item.status}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.requestInfo}>
                        <Text style={styles.requestLabel}>
                            {item.type === 'AR' ? 'Payee:' : 'Payer:'} {item.type === 'AR' ? item.payee : item.payer}
                        </Text>
                        <Text style={styles.requestDate}>
                            Due: {new Date(item.dueDate * 1000).toLocaleDateString()}
                        </Text>
                    </View>

                    {item.externalId && (
                        <Text style={styles.externalId}>ID: {item.externalId}</Text>
                    )}
                </Card.Content>
            </Card>
        </TouchableOpacity>
    );

    if (!username) {
        return (
            <View style={styles.container}>
                <Appbar.Header style={styles.header}>
                    <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
                    <Appbar.Content title="Payment Links" titleStyle={styles.headerTitle} />
                </Appbar.Header>
                <View style={styles.centerContent}>
                    <Text style={styles.loginMessage}>Please login to create payment links</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Appbar.Header style={styles.header}>
                <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
                <Appbar.Content title="Payment Links" titleStyle={styles.headerTitle} />
                {generatedLink && selectedTab === 'create' && (
                    <Appbar.Action icon="refresh" iconColor="#fff" onPress={resetForm} />
                )}
                {selectedTab === 'created' && (
                    <Appbar.Action icon="refresh" iconColor="#fff" onPress={loadPaymentRequests} />
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
                            secondaryContainer: '#3b82f6',
                            onSecondaryContainer: '#ffffff',
                            outline: DARK_BORDER,
                        },
                    }}
                />
            </View>

            {/* Tab Content */}
            {selectedTab === 'create' ? (
                <ScrollView ref={scrollViewRef} style={styles.content} showsVerticalScrollIndicator={false}>
                    {showUserSearch ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Select Payee</Text>
                            <PayeeSearch onSelect={handleUserSelect} onClose={() => setShowUserSearch(false)} />
                        </View>
                    ) : (
                        <>
                            <List.Accordion
                                title="Create Payment Link"
                                expanded={formExpanded}
                                onPress={() => setFormExpanded(!formExpanded)}
                                left={props => <List.Icon {...props} icon="form-select" color="#3b82f6" />}
                                style={styles.metricsAccordion}
                                theme={{ colors: { background: DARK_CARD } }}
                            >
                                {/* Payee Selection */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>To (Payee) *</Text>
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
                                            <Text style={styles.selectButtonText}>Select Payee</Text>
                                            <Icon name="chevron-right" size={20} color="#a1a1aa" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Currency Selection */}
                                <View style={styles.section}>
                                    <Text style={styles.label}>Currency *</Text>
                                    <Menu
                                        visible={currencyMenuVisible}
                                        onDismiss={() => setCurrencyMenuVisible(false)}
                                        contentStyle={styles.menuContent}
                                        anchor={
                                            <TouchableOpacity
                                                style={styles.dropdown}
                                                onPress={() => setCurrencyMenuVisible(true)}
                                            >
                                                <Text style={styles.dropdownText}>
                                                    {currencyName(currency)}
                                                </Text>
                                                <Icon name="chevron-down" size={20} color="#a1a1aa" />
                                            </TouchableOpacity>
                                        }
                                    >
                                        <ScrollView style={{ maxHeight: 200 }}>
                                            {ALLOWED_FIAT.map((fiat) => (
                                                <Menu.Item
                                                    key={fiat}
                                                    onPress={() => {
                                                        setCurrency(fiat);
                                                        setCurrencyMenuVisible(false);
                                                    }}
                                                    title={currencyName(fiat)}
                                                    titleStyle={styles.menuItemText}
                                                />
                                            ))}
                                        </ScrollView>
                                    </Menu>
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

                                {/* Token Selection (only show if not USD/EUR) */}
                                {currency !== 'USD' && currency !== 'EUR' && (
                                    <View style={styles.section}>
                                        <Text style={styles.label}>Token</Text>
                                        <Menu
                                            visible={tokenMenuVisible}
                                            onDismiss={() => setTokenMenuVisible(false)}
                                            contentStyle={styles.menuContent}
                                            anchor={
                                                <TouchableOpacity
                                                    style={styles.dropdown}
                                                    onPress={() => setTokenMenuVisible(true)}
                                                >
                                                    <Text style={styles.dropdownText}>{token}</Text>
                                                    <Icon name="chevron-down" size={20} color="#a1a1aa" />
                                                </TouchableOpacity>
                                            }
                                        >
                                            <Menu.Item
                                                onPress={() => {
                                                    setToken('USDC');
                                                    setTokenMenuVisible(false);
                                                }}
                                                title="USDC"
                                                titleStyle={styles.menuItemText}
                                            />
                                            <Menu.Item
                                                onPress={() => {
                                                    setToken('EURC');
                                                    setTokenMenuVisible(false);
                                                }}
                                                title="EURC"
                                                titleStyle={styles.menuItemText}
                                            />
                                        </Menu>
                                    </View>
                                )}

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
                                        disabled={loading || !selectedUser || !amount || !currency}
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
                        </>
                    )}
                </ScrollView>
            ) : (
                // Created Links Tab
                <View style={styles.content}>
                    {/* Monthly Metrics Section */}
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
                                        currency={monthlyMetrics.currency}
                                        color="#10b981"
                                        icon="trending-up"
                                    />
                                    <MetricsCard
                                        title="Expenses (AP)"
                                        amount={monthlyMetrics.expenses}
                                        currency={monthlyMetrics.currency}
                                        color="#ef4444"
                                        icon="trending-down"
                                    />
                                    <MetricsCard
                                        title="Cash Flow"
                                        amount={monthlyMetrics.cashFlow}
                                        currency={monthlyMetrics.currency}
                                        color={monthlyMetrics.cashFlow >= 0 ? "#10b981" : "#ef4444"}
                                        icon={monthlyMetrics.cashFlow >= 0 ? "cash-plus" : "cash-minus"}
                                    />
                                </View>
                            </View>
                        </List.Accordion>
                    </View>

                    {/* Payment Requests List */}
                    {loadingRequests ? (
                        <View style={styles.centerContent}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={styles.loadingText}>Loading payment requests...</Text>
                        </View>
                    ) : paymentRequests.length === 0 ? (
                        <View style={styles.centerContent}>
                            <Icon name="receipt" size={64} color="#6b7280" />
                            <Text style={styles.emptyText}>No payment requests yet</Text>
                            <Text style={styles.emptySubtext}>Create your first payment link to get started</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={paymentRequests}
                            renderItem={renderPaymentRequestCard}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContainer}
                        />
                    )}
                </View>
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
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: DARK_BORDER,
    },
    requestHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    requestAmount: {
        flex: 1,
    },
    amountText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    tokenText: {
        color: '#a1a1aa',
        fontSize: 14,
        marginTop: 2,
    },
    requestBadges: {
        flexDirection: 'row',
        gap: 8,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    requestInfo: {
        marginBottom: 8,
    },
    requestLabel: {
        color: '#a1a1aa',
        fontSize: 14,
        marginBottom: 4,
    },
    requestDate: {
        color: '#a1a1aa',
        fontSize: 14,
    },
    externalId: {
        color: '#71717a',
        fontSize: 12,
        fontFamily: 'monospace',
        marginTop: 4,
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
});
