import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDragDropManager } from 'react-dnd';
import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { createDragAutoScroller } from '@/lib/dragAutoScroll';
import '@/styles/class-drag-scroll.css';

const ClassDragScrollAssist = () => {
  const manager = useDragDropManager();
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => createDragAutoScroller({
    monitor: manager.getMonitor(),
    onDraggingChange: setIsDragging,
  }), [manager]);

  if (!isDragging) return null;
  return createPortal(
    <div className="class-drag-scroll-assist" role="status" aria-live="polite">
      <div className="class-drag-scroll-assist__edge class-drag-scroll-assist__edge--top" aria-hidden="true"><ChevronsUp /></div>
      <div className="class-drag-scroll-assist__edge class-drag-scroll-assist__edge--bottom" aria-hidden="true"><ChevronsDown /></div>
      <p>Tarik mendekati tepi atas/bawah untuk scroll otomatis</p>
    </div>,
    document.body,
  );
};

export default ClassDragScrollAssist;
