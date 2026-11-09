import type { Product } from '../../../types';

export interface BranchCatalogCategories {
  categories: { id: string; name: string; productCount: number }[];
  uncategorizedCount: number;
  totalCount: number;
}

export interface CatalogProductPage {
  items: Product[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export type CatalogProductFilter = { categoryId?: string; uncategorized?: boolean; cursor?: string };
export const UNCATEGORIZED_CATEGORY = 'uncategorized';
