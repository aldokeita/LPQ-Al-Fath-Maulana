import React from 'react';
import { useDrag } from 'react-dnd';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

const HafalanItemDraggable = ({ item, isDraggable, onDelete }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'HAFALAN_ITEM',
    item: { id: item.id, item_name: item.item_name, jilid: item.jilid },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    canDrag: isDraggable,
  }), [item, isDraggable]);

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

      {onDelete && (
        <button
            onClick={() => onDelete(item.id)}
            className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      )}
    </div>
  );
};

export default HafalanItemDraggable;
