import React from 'react';
import { useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import HafalanItemDraggable from '@/components/dashboard/admin/HafalanItemDraggable';
import { Check, Loader2, Circle, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import DevelopmentScoreSelector from '@/components/dashboard/shared/DevelopmentScoreSelector';

const HafalanDisplay = ({
    jilid,
    titlePrefix = 'Jilid',
    items,
    isDraggable = false,
    onItemDrop,
    onDeleteItem,
    progressData = null, // Optional: { [itemName]: boolean }
    scoreData = null, // Optional: { [itemName]: 1 | 2 | 3 | 4 }
    onScoreChange = null,
    isLoading = false,
    onItemClick = null, // New prop for click interaction
    isInteractive = false // Flag to enable click interactivity
}) => {
    const [{ isOver }, drop] = useDrop(() => ({
        accept: 'HAFALAN_ITEM',
        drop: (item) => {
            if (item.jilid !== jilid && onItemDrop) {
                onItemDrop(item.id, jilid);
            }
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }), [jilid, onItemDrop]);

    const displayItems = items || [];
    // progressData is expected to be an object where keys are item names and values are booleans (hafal status)
    const hasScoring = scoreData !== null;
    const completedCount = hasScoring
        ? displayItems.filter(i => Number(scoreData[i.item_name]) === 4).length
        : progressData ? displayItems.filter(i => progressData[i.item_name]).length : 0;
    const totalCount = displayItems.length;
    const isCompleted = totalCount > 0 && completedCount === totalCount;

    // Determine if we should allow clicks
    const canClick = isInteractive && onItemClick;

    return (
        <div
            ref={isDraggable ? drop : null}
            className={cn(
                "flex min-w-0 flex-col h-full border rounded-xl overflow-hidden transition-all duration-300",
                isOver ? "bg-blue-50 border-blue-400 ring-2 ring-blue-200" : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800",
                isCompleted && !isDraggable ? "bg-green-50/50 border-green-200" : ""
            )}
        >
            <div className={cn(
                "px-3 py-2 border-b flex justify-between items-center",
                isCompleted && !isDraggable ? "bg-green-100/50 text-green-800" : "bg-slate-100/50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            )}>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{[titlePrefix, jilid].filter(Boolean).join(' ')}</span>
                    {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                {progressData || hasScoring ? (
                     <Badge variant={isCompleted ? "success" : "secondary"} className={cn("text-[10px] h-5 px-1.5", isCompleted && "bg-green-200 text-green-800 hover:bg-green-300")}>
                        {completedCount}/{totalCount}
                     </Badge>
                ) : (
                    <span className="text-xs text-muted-foreground">{totalCount} item</span>
                )}
            </div>

            <ScrollArea className="flex-1 p-2 h-[180px]">
                <div className="grid grid-cols-1 gap-2">
                    {displayItems.length > 0 ? (
                        displayItems.map(item => {
                            // Check if this item is marked as hafal in progressData
                            const itemScore = hasScoring ? scoreData[item.item_name] : null;
                            const isHafal = hasScoring ? Number(itemScore) === 4 : progressData && progressData[item.item_name];
                            return (
                                <div key={item.id} className="relative group">
                                    {hasScoring ? (
                                        <div className={cn(
                                            "grid min-w-0 gap-2 rounded-lg border p-2 text-sm transition-colors",
                                            isHafal
                                                ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/25 dark:bg-slate-900/70"
                                                : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950"
                                        )}>
                                            <div className="flex items-center gap-2">
                                                <span className="min-w-0 flex-1 truncate font-medium" title={item.item_name}>{item.item_name}</span>
                                                {isHafal && <CheckCircle2 className="h-4 w-4 flex-none text-emerald-600" aria-label="Hafalan tercapai" />}
                                            </div>
                                            <DevelopmentScoreSelector
                                                value={itemScore}
                                                onChange={onScoreChange ? (score) => onScoreChange(item, score) : undefined}
                                                compact
                                            />
                                        </div>
                                    ) : progressData ? (
                                        <div
                                            onClick={() => canClick && onItemClick(item)}
                                            className={cn(
                                                "flex items-center justify-between p-2 rounded-lg border text-sm transition-all duration-200",
                                                canClick ? "cursor-pointer hover:shadow-sm active:scale-[0.98]" : "",
                                                isHafal
                                                    ? "bg-green-50 border-green-200 text-green-900 dark:bg-slate-900/70 dark:border-emerald-400/25 dark:text-emerald-100 shadow-sm"
                                                    : "bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                                            )}
                                        >
                                            <span className="truncate flex-1 font-medium" title={item.item_name}>{item.item_name}</span>
                                            {isHafal ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-600 animate-in zoom-in duration-300" />
                                            ) : (
                                                canClick && <Circle className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                                            )}
                                        </div>
                                    ) : (
                                        <HafalanItemDraggable
                                            item={item}
                                            isDraggable={isDraggable}
                                            onDelete={onDeleteItem}
                                        />
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic py-8">
                            {isDraggable ? "Drop item di sini" : "Kosong"}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default HafalanDisplay;
