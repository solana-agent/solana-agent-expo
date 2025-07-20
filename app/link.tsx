import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Appbar, TextInput, Button, Menu, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { UserSearch } from '../components/UserSearch';
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

export default function CreatePaymentScreen() {
    const router = useRouter();
    const { username } = useAppStore();
    const { getAccessToken } = usePrivy();

    // Form state
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [currency, setCurrency] = useState('USD');
    const [amount, setAmount] = useState('');
    const [token, setToken] = useState('USDC');
    const [dueDate, setDueDate] = useState(new Date());
    const [externalId, setExternalId] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
    const [generatedLink, setGeneratedLink] = useState('');

    // UI state
    const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
    const [tokenMenuVisible, setTokenMenuVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showUserSearch, setShowUserSearch] = useState(false);
    const [loading, setLoading] = useState(false);

    // Update token when currency changes
    useEffect(() => {
        if (currency === 'EUR') {
            setToken('EURC');
        } else if (currency === 'USD') {
            setToken('USDC');
        }
        // For other currencies, keep the current token selection (don't auto-change)
    }, [currency]);

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
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                setAttachedFiles([...attachedFiles, result.assets[0]]);
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
            // Get access token for API authentication
            const accessToken = await getAccessToken();
            if (!accessToken) {
                throw new Error('No access token available');
            }

            // Prepare the payment request data
            const paymentData = {
                payee: selectedUser.id, // Who should receive the payment
                payer: username, // Who created the payment request (you)
                amount: parseFloat(amount),
                currency: currency,
                token: token,
                dueDate: Math.floor(dueDate.getTime() / 1000), // Convert to Unix timestamp
                externalId: externalId || null,
                attachments: attachedFiles.length > 0 ? attachedFiles : null,
                memo: `Payment request from ${username} to ${selectedUser.name || selectedUser.id}`,
            };

            console.log('Creating payment request:', paymentData);

            // Send to your backend API
            const response = await fetch(`${API_URL}/payment/create-request`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(paymentData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create payment request');
            }

            const result = await response.json();

            // The API should return something like: { id: 'unique-payment-id', link: 'https://sol-pay.co/pay/unique-payment-id' }
            const link = `https://sol-pay.co/pay/${result.id}`;
            setGeneratedLink(link);

            Alert.alert('Success', 'Payment request created successfully!');

        } catch (error) {
            console.error('Error creating payment request:', error);
            Alert.alert('Error', 'Failed to create payment request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

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

    if (!username) {
        return (
            <View style={styles.container}>
                <Appbar.Header style={styles.header}>
                    <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
                    <Appbar.Content title="Create Payment Link" titleStyle={styles.headerTitle} />
                </Appbar.Header>
                <View style={styles.centerContent}>
                    <Text style={styles.errorText}>Please set up your username first</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Appbar.Header style={styles.header}>
                <Appbar.BackAction iconColor="#fff" onPress={() => router.back()} />
                <Appbar.Content title="Create Payment Link" titleStyle={styles.headerTitle} />
                {generatedLink && (
                    <Appbar.Action icon="refresh" iconColor="#fff" onPress={resetForm} />
                )}
            </Appbar.Header>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {showUserSearch ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Select Payee</Text>
                        <UserSearch onUserSelect={handleUserSelect} onClose={() => setShowUserSearch(false)} />
                    </View>
                ) : (
                    <>
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
                                <Icon name="paperclip" size={20} color="#3b82f6" />
                                <Text style={styles.uploadButtonText}>Attach File</Text>
                            </TouchableOpacity>

                            {attachedFiles.map((file, index) => (
                                <View key={index} style={styles.fileItem}>
                                    <Icon name="file" size={16} color="#a1a1aa" />
                                    <Text style={styles.fileName}>{file.name}</Text>
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
    section: {
        marginBottom: 24,
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
        backgroundColor: '#3b82f6',
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
});
