import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../lib/ThemeContext';

export default function BrandLogo() {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/boname-logo.png')}
        accessibilityLabel="bona’me"
        contentFit="contain"
        tintColor={colors.onSurface}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
