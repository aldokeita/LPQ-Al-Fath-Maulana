import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DataPagination = ({ currentPage, totalItems, pageSize = 10, onPageChange, itemLabel = 'data' }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const firstItem = totalItems === 0 ? 0 : ((safePage - 1) * pageSize) + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Menampilkan <span className="font-semibold text-foreground">{firstItem}-{lastItem}</span> dari{' '}
        <span className="font-semibold text-foreground">{totalItems}</span> {itemLabel}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Buka halaman sebelumnya"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Sebelumnya
        </Button>
        <span className="min-w-24 text-center text-sm font-medium text-foreground">
          Halaman {safePage} dari {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Buka halaman berikutnya"
        >
          Berikutnya <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default DataPagination;
