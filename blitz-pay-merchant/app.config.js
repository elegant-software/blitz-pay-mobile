module.exports = {
  expo: {
    name: "BlitzPay Merchant",
    slug: "blitzpay-merchant",
    scheme: "blitzpaymerchant",
    // Rewritten from the GitHub release tag by cd-build-mobile-app.yml; shown in Account and used as runtimeVersion.
    version: "1.0.0",
    runtimeVersion: { policy: "appVersion" },
    updates: { url: "https://u.expo.dev/c42ff88d-abd7-4905-9996-fefa3a619370" },
    orientation: "default",
    platforms: ["ios", "android", "web"],
    userInterfaceStyle: "light",
    icon: "./assets/app-icon.png",
    splash: {
      image: "./assets/app-icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "app.blitzpay.merchant",
      entitlements: {
        "com.apple.developer.proximity-reader.payment.acceptance": true,
      },
      infoPlist: {
        NSCameraUsageDescription: "Used to scan QR codes for payments",
        NSFaceIDUsageDescription: "Used for biometric authentication",
        NSBluetoothAlwaysUsageDescription: "Used to connect to card readers for in-person payments",
        NSLocationWhenInUseUsageDescription: "BlitzPay Merchant uses your location to detect your active branch.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "BlitzPay Merchant monitors branch proximity in the background to improve your experience.",
        UIBackgroundModes: ["remote-notification", "location"],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000",
      },
      splash: {
        image: "./assets/app-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
      },
      package: "app.blitzpay.merchant",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "CAMERA",
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
      ],
    },
    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 26,
          },
          ios: {
            deploymentTarget: "15.1",
          },
        },
      ],
      ["expo-splash-screen", { backgroundColor: "#000000", image: "./assets/app-icon.png", imageWidth: 200 }],
      ["expo-camera", { cameraPermission: "Allow BlitzPay Merchant to access your camera to scan QR codes." }],
      ["expo-location", {
        locationWhenInUsePermission: "Allow BlitzPay Merchant to access your location to detect your active branch.",
        locationAlwaysAndWhenInUsePermission: "Allow BlitzPay Merchant to monitor branch proximity in the background.",
      }],
      ["expo-local-authentication", { faceIDPermission: "Allow BlitzPay Merchant to use Face ID for authentication." }],
      "expo-secure-store",
      ["expo-notifications", { sounds: [] }],
      "expo-font",
      ["@stripe/stripe-terminal-react-native", { appDelegate: true, tapToPayCheck: true }],
      ["react-native-nfc-manager", {
        nfcPermission: "BlitzPay Merchant writes your table links to NFC stickers so guests can tap to order.",
        includeNdefEntitlement: true,
      }],
    ],
    extra: {
      eas: {
        projectId: "c42ff88d-abd7-4905-9996-fefa3a619370"
      },
    },
    owner: "m.mohammadi",
  },
};
