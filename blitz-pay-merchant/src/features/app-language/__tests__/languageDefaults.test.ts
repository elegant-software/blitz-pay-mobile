import { resolveDefaultLanguage } from '../store/languagePreferencesStore';

test.each([
  [['en-US'], 'en'], [['de-AT'], 'de'], [['fr-FR', 'en-GB'], 'en'],
  [['fr', 'es'], 'de'], [[], 'de'], [['EN_us'], 'en'], [['de', 'en'], 'de'],
])('resolves supported defaults from %j', (locales, expected) => {
  expect(resolveDefaultLanguage(locales as string[])).toBe(expected);
});

