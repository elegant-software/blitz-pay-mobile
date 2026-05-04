module.exports = {
  expo: {
    name: "BlitzPay Merchant",
    slug: "blitzpay-merchant",
    scheme: "blitzpaymerchant",
    version: "1.0.0",
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
      infoPlist: {
        NSCameraUsageDescription: "Used to scan QR codes for payments",
        NSFaceIDUsageDescription: "Used for biometric authentication",
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
    ],
    extra: {
      eas: {
        projectId: "",
      },
    },
    owner: "m.mohammadi",
  },
};
