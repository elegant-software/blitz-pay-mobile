import React, { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../../lib/LanguageContext';
import { colors, radius, spacing } from '../../../lib/theme';
import type { SignupVertical } from '../services/merchantRegistration';

interface Props {
  options: SignupVertical[];
  value: string;
  loading: boolean;
  onChange: (code: string) => void;
}

export default function BusinessTypeAutocomplete({options, value, loading, onChange}: Props) {
  const {t} = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.code === value);
  const normalized = query.trim().toLocaleLowerCase();
  const matches = options.filter(option => `${option.displayName} ${option.code}`.toLocaleLowerCase().includes(normalized));

  if (loading) return <View accessibilityLabel={t('loading')} accessibilityState={{busy: true}} style={styles.skeleton}>
    <View accessible={false} style={styles.skeletonLine}/>
    <View accessible={false} style={[styles.skeletonLine, styles.skeletonShort]}/>
  </View>;

  return <View>
    <View style={[styles.inputRow, open && styles.focused]}>
      <Ionicons name="search-outline" size={19} color={colors.gray300}/>
      <TextInput
        style={styles.input}
        accessibilityLabel={t('registration_business_type')}
        accessibilityRole="combobox"
        accessibilityState={{expanded: open}}
        placeholder={t('registration_search_business_types')}
        placeholderTextColor={colors.gray500}
        value={open ? query : selected?.displayName ?? ''}
        autoCorrect={false}
        autoCapitalize="none"
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChangeText={text => { setQuery(text); setOpen(true); onChange(''); }}
        onKeyPress={({nativeEvent}) => { if (nativeEvent.key === 'Escape') { setOpen(false); Keyboard.dismiss(); } }}
      />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(open ? 'registration_close_options' : 'registration_search_business_types')}
        onPress={() => { setQuery(''); setOpen(!open); Keyboard.dismiss(); }} style={styles.toggle}>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.gray300}/>
      </TouchableOpacity>
    </View>
    {open ? <View style={styles.results}>
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.list}>
        {matches.map(option => <TouchableOpacity key={option.code} accessibilityRole="button"
          accessibilityState={{selected: option.code === value}} style={styles.option}
          onPress={() => { onChange(option.code); setQuery(''); setOpen(false); Keyboard.dismiss(); }}>
          <Text style={[styles.optionText, option.code === value && styles.selected]}>{option.displayName}</Text>
          {option.code === value ? <Ionicons name="checkmark" size={20} color={colors.primary}/> : null}
        </TouchableOpacity>)}
        {!matches.length ? <Text accessibilityLiveRegion="polite" style={styles.empty}>{t('registration_no_matching_business_types')}</Text> : null}
      </ScrollView>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  inputRow: {flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)'},
  focused: {borderColor: colors.primary},
  input: {flex: 1, minWidth: 0, padding: spacing.md, fontSize: 15, color: colors.white},
  toggle: {minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center'},
  results: {marginTop: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', backgroundColor: '#17172C'},
  list: {maxHeight: 220},
  option: {minHeight: 48, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  optionText: {flex: 1, color: colors.white, fontSize: 15},
  selected: {color: colors.primary, fontWeight: '600'},
  empty: {padding: spacing.md, color: colors.gray300, fontSize: 14, lineHeight: 20},
  skeleton: {minHeight: 58, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.05)'},
  skeletonLine: {height: 10, width: '65%', borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.12)'},
  skeletonShort: {width: '40%'},
});
