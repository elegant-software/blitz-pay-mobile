// Table Links (https://<storefront host>/t/{code}) open the app via universal/app links. The host comes
// from EXPO_PUBLIC_STOREFRONT_URL; without it no association is declared.
const storefrontHost = (() => {
  const match = /^https:\/\/([^/?#:]+)/i.exec(process.env.EXPO_PUBLIC_STOREFRONT_URL ?? "");
  return match ? match[1].toLowerCase() : null;
})();

module.exports = {
  expo: {
    name: "BlitzPay",
    slug: "blitzpay-mobile",
    scheme: "blitzpay",
    // Rewritten from the GitHub release tag by cd-build-mobile-app.yml; shown in Account and used as runtimeVersion.
    version: "1.0.0",
    runtimeVersion: { policy: "appVersion" },
    updates: { url: "https://u.expo.dev/283f0dd6-d7d4-4dcc-8613-66621b812e7f" },
    orientation: "portrait",
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
      bundleIdentifier: "app.blitzpay.mobile",
      ...(storefrontHost ? { associatedDomains: [`applinks:${storefrontHost}`] } : {}),
      infoPlist: {
        NSCameraUsageDescription: "Used to scan QR codes and credit cards for payments",
        NSFaceIDUsageDescription: "Used for biometric authentication",
        NSMicrophoneUsageDescription: "BlitzPay uses your microphone to send voice queries to the AI assistant.",
        NSLocationWhenInUseUsageDescription: "BlitzPay uses your location to find nearby merchants.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "BlitzPay monitors merchant areas in the background to alert you to offers.",
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
      package: "app.blitzpay.mobile",
      ...(storefrontHost
        ? {
            intentFilters: [
              {
                action: "VIEW",
                autoVerify: true,
                data: [{ scheme: "https", host: storefrontHost, pathPrefix: "/t/" }],
                category: ["BROWSABLE", "DEFAULT"],
              },
            ],
          }
        : {}),
      googleServicesFile: "./google-services.json",
      permissions: [
        "CAMERA",
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
      ],
    },
    plugins: [
      [
        "@stripe/stripe-react-native",
        {
          merchantIdentifier: "merchant.app.blitzpay.mobile",
          enableGooglePay: true,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            packagingOptions: {
              pickFirst: ["META-INF/LICENSE-MIT"],
              exclude: ["META-INF/AL2.0", "META-INF/LGPL2.1"],
            },
          },
          ios: {
            deploymentTarget: "15.1",
          },
        },
      ],
      "./plugins/withBraintreeMavenRepo",
      ["expo-splash-screen", { backgroundColor: "#000000", image: "./assets/app-icon.png", imageWidth: 200 }],
      ["expo-camera", { cameraPermission: "Allow BlitzPay to access your camera to scan QR codes." }],
      ["expo-local-authentication", { faceIDPermission: "Allow BlitzPay to use Face ID for authentication." }],
      "expo-secure-store",
      ["expo-location", {
        locationAlwaysAndWhenInUsePermission:
          "BlitzPay monitors merchant areas in the background to alert you to offers.",
      }],
      ["expo-notifications", { sounds: [] }],
      "expo-audio",
      ["./plugins/withNdkVersion", "30.0.14904198"],
      "./plugins/withTrueLayerAndroidConfig",
      "expo-font",
      "./plugins/withNetworkSecurityConfig",
      [
        "react-native-expo-braintree",
        {
          host: "blitzpay.example.com",
          pathPrefix: "/paypal-return",
          addFallbackUrlScheme: "true",
          appDelegateLanguage: "swift",
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "283f0dd6-d7d4-4dcc-8613-66621b812e7f",
      },
    },
    owner: "m.mohammadi",
  },
};
