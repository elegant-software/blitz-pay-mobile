import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLanguage } from '../../../lib/LanguageContext';
import { colors, spacing } from '../../../lib/theme';
import { useVersionInfo } from '../hooks/useVersionInfo';
import { formatUpdateLine, formatVersionLine } from '../services/versionService';

export default function VersionLine() {
  const { t } = useLanguage();
  const info = useVersionInfo();
  const updateLine = formatUpdateLine(info);

  return (
    <>
      <Text style={styles.text} selectable>{formatVersionLine(info, t('version_unknown'))}</Text>
      {updateLine ? <Text style={styles.text} selectable>{updateLine}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 11, color: colors.gray400, textAlign: 'center', marginTop: spacing.xs },
});
