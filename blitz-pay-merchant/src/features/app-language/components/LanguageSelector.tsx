import { useTheme } from "../../../lib/ThemeContext";
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguage } from '../../../lib/LanguageContext';
import { spacing, radius, type ThemeColors } from '../../../lib/theme';

export function LanguageSelector() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { language, setLanguage, t } = useLanguage();
  return (
    <View style={styles.row} accessibilityLabel={t('language')}>
      {(['de', 'en'] as const).map(value => (
        <TouchableOpacity
          key={value}
          accessibilityRole="button"
          accessibilityState={{ selected: language === value }}
          onPress={() => setLanguage(value)}
          style={[styles.button, language === value && styles.selected]}
        >
          <Text style={[styles.label, language === value && { color: colors.white }]}>{t(value === 'de' ? 'language_german' : 'language_english')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  button: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray400 },
  selected: { borderColor: colors.primary, backgroundColor: colors.secondary },
  label: { color: colors.onSurface, fontWeight: '600' },
});

