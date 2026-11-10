import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../../../lib/LanguageContext';
import { colors, radius, spacing } from '../../../lib/theme';
import { UNCATEGORIZED_CATEGORY } from '../types/catalog';

type Props = {
  categories: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  uncategorizedCount: number;
};

export function CatalogCategories({ categories, selectedId, onSelect, uncategorizedCount }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={[{ id: '', name: t('catalog_all') }, ...categories,
          ...(uncategorizedCount > 0 ? [{ id: UNCATEGORIZED_CATEGORY, name: t('catalog_uncategorized') }] : [])]}
        extraData={selectedId}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === selectedId }}
            onPress={() => onSelect(item.id)}
            style={[styles.chip, item.id === selectedId && styles.selected]}
          >
            <Text style={[styles.label, item.id === selectedId && styles.selectedLabel]}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.white },
  content: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.primary },
  label: { color: colors.onSurface, fontWeight: '600', fontSize: 14 },
  selectedLabel: { color: colors.black },
});
