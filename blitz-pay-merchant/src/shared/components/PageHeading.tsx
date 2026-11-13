import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/ThemeContext';

interface Props {
  title: string;
  eyebrow?: string;
  subtitle?: string | null;
  action?: React.ReactNode;
}

export default function PageHeading({
  title,
  eyebrow,
  subtitle,
  action,
}: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.secondary }]}>
          {eyebrow}
        </Text>
      ) : null}
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.onSurface }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.gray600 }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -1, lineHeight: 39 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 6 },
});
