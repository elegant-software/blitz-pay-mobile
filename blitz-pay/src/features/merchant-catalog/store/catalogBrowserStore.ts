import { useSyncExternalStore } from 'react';

const selections = new Map<string, string>();
const listeners = new Set<() => void>();

export function useCatalogSelection(scope: string) {
  const categoryId = useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => selections.get(scope),
    () => undefined,
  );
  return {
    categoryId,
    selectCategory: (id: string) => {
      selections.set(scope, id);
      listeners.forEach(listener => listener());
    },
  };
}
