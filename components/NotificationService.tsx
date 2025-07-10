import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    let token = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('transactions', {
        name: 'Transaction Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6d28d9',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      
      try {
        token = (
          await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
          })
        ).data;
      } catch (e) {
        console.log('Error getting push token:', e);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  static async sendTransactionNotification(type: 'sent' | 'received' | 'swap', amount: string, input_token: string, output_token?: string, recipient?: string) {
    const title = type === 'sent' ? '💸 Payment Sent' : type === 'received' ? '💰 Payment Received' : '🔄 Swap Completed';
    const body = type === 'sent' 
      ? `Successfully sent ${amount} ${input_token}${recipient ? ` to ${recipient}` : ''}`
      : type === 'received'
      ? `Received ${amount} ${input_token}`
      : `Swapped ${amount} ${input_token} for ${output_token}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { type, amount, input_token, output_token, recipient },
      },
      trigger: null, // Show immediately
    });
  }

  static async sendErrorNotification(message: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '❌ Transaction Error',
        body: message,
        sound: 'default',
        data: { type: 'error' },
      },
      trigger: null,
    });
  }

  static async sendAgentNotification(message: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🤖 Agent Update',
        body: message,
        sound: 'default',
        data: { type: 'agent' },
      },
      trigger: null,
    });
  }
}
