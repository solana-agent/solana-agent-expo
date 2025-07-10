import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

export class BiometricService {
  static async isAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  }

  static async authenticate(reason: string = "Authenticate to access your wallet"): Promise<boolean> {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        Alert.alert(
          "Biometric Authentication Unavailable",
          "Please ensure biometric authentication is set up on your device."
        );
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: "Use Passcode",
        disableDeviceFallback: false,
        cancelLabel: "Cancel",
      });

      if (result.success) {
        return true;
      }

      // Handle cancellation and other errors
      if (
        result.error === 'user_cancel' ||
        result.error === 'system_cancel' ||
        result.error === 'app_cancel' ||
        result.error === 'authentication_failed' ||
        result.error === 'not_enrolled' ||
        result.error === 'lockout'
      ) {
        // Don't show an alert for user/system/app cancel, just return false
        return false;
      }

      // Show alert for other errors
      if (result.error) {
        Alert.alert("Authentication Failed", result.error);
      } else {
        Alert.alert("Authentication Failed", "Unknown error occurred");
      }
      return false;
    } catch (error) {
      console.error("Biometric authentication error:", error);
      Alert.alert("Authentication Error", "An error occurred during authentication");
      return false;
    }
  }
}