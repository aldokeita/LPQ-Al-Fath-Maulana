import React, { useEffect, useRef, useState } from 'react';
import { useDrag } from 'react-dnd';
import { cn } from '@/lib/utils';
import { Check, GripVertical, Loader2, Pencil, Trash2, X } from 'lucide-react';

const HafalanItemDraggable = ({ item, isDraggable, onDelete, onRename }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.item_name);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'HAFALAN_ITEM',
    item: { id: item.id, item_name: item.item_name, jilid: item.jilid },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    canDrag: isDraggable && !isEditing,
  }), [item, isDraggable, isEditing]);

  useEffect(() => {
    if (!isEditing) setDraft(item.item_name);
  }, [item.item_name, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const cancelEdit = () => {
    setDraft(item.item_name);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const ok = await onRename(item, draft);
    setIsSaving(false);
    if (ok) setIsEditing(false);
    else inputRef.current?.focus();
  };

  if (isEditing) {
    return (
      <form
        className="flex items-center gap-1 rounded-lg border border-primary/50 bg-white p-1.5 ring-2 ring-primary/15 dark:bg-slate-900"
        onSubmit={(event) => { event.preventDefault(); saveEdit(); }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape') cancelEdit(); }}
          disabled={isSaving}
          aria-label={`Ubah nama ${item.item_name}`}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <button
          type="submit"
          disabled={isSaving}
          aria-label="Simpan nama"
          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50 dark:hover:bg-emerald-500/10"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          disabled={isSaving}
          aria-label="Batal ubah nama"
          className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 dark:hover:bg-slate-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  return (
    <div
      ref={isDraggable ? drag : null}
      className={cn(
        "relative flex items-center justify-between p-2 rounded-lg border bg-white dark:bg-slate-900 transition-all",
        isDragging ? "opacity-50 scale-95 shadow-none" : "hover:shadow-sm",
        isDraggable ? "cursor-move" : "cursor-default"
      )}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        {isDraggable && <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <span className="text-sm font-medium truncate" title={item.item_name}>
          {item.item_name}
        </span>
      </div>

      <div className="flex flex-shrink-0 items-center">
        {onRename && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label={`Ubah nama ${item.item_name}`}
            title="Ubah nama"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-slate-800"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            aria-label={`Hapus ${item.item_name}`}
            title="Hapus"
            className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default HafalanItemDraggable;
