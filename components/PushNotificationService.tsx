import Constants from 'expo-constants';
import { NotificationService } from './NotificationService';

const API_URL = Constants.expoConfig?.extra?.apiUrl;
export class PushNotificationService {
  static async registerPushToken(walletAddress: string, getAccessToken: () => Promise<string | null>): Promise<boolean> {
    try {
      // Get push token from NotificationService
      const expoPushToken = await NotificationService.registerForPushNotificationsAsync();

      if (!expoPushToken) {
        console.log('Failed to get push token');
        return false;
      }

      // Get JWT token
      const jwt = await getAccessToken();
      if (!jwt) {
        console.log('No JWT token available');
        return false;
      }

      // Register with backend
      const response = await fetch(`${API_URL}/register-push-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expo_push_token: expoPushToken,
          wallet_address: walletAddress,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Push token registered successfully:', data);
        return true;
      } else {
        console.error('Failed to register push token:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error registering push token:', error);
      return false;
    }
  }

  static async unregisterPushToken(walletAddress: string, getAccessToken: () => Promise<string | null>): Promise<boolean> {
    try {
      const jwt = await getAccessToken();
      if (!jwt) {
        console.log('No JWT token available');
        return false;
      }

      const response = await fetch(`${API_URL}/unregister-push-token/${walletAddress}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('Push token unregistered successfully');
        return true;
      } else {
        console.error('Failed to unregister push token:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error unregistering push token:', error);
      return false;
    }
  }
}
