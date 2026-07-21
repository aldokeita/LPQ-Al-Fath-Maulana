import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { LayoutGroup, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const TabsAnimationContext = React.createContext({
  activeValue: undefined,
  layoutId: 'ui-tabs-active-pill',
});

const Tabs = React.forwardRef(({
  value,
  defaultValue,
  onValueChange,
  ...props
}, ref) => {
  const instanceId = React.useId();
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeValue = value !== undefined ? value : internalValue;
  const layoutId = `ui-tabs-active-pill-${instanceId}`;

  const handleValueChange = React.useCallback((nextValue) => {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }, [onValueChange, value]);

  return (
    <TabsAnimationContext.Provider value={{ activeValue, layoutId }}>
      <LayoutGroup id={`ui-tabs-group-${instanceId}`}>
        <TabsPrimitive.Root
          ref={ref}
          value={activeValue}
          onValueChange={handleValueChange}
          {...props}
        />
      </LayoutGroup>
    </TabsAnimationContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'ui-glass-tabs-list inline-flex h-auto items-center justify-start rounded-2xl border border-white/60 bg-white/55 p-1 text-muted-foreground shadow-[inset_1px_1px_0_rgba(255,255,255,0.85),0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl flex-wrap dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[inset_1px_1px_0_rgba(255,255,255,0.08),0_14px_34px_rgba(0,0,0,0.24)]',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, children, value, ...props }, ref) => {
  const { activeValue, layoutId } = React.useContext(TabsAnimationContext);
  const isActive = activeValue === value;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        'ui-glass-tabs-trigger relative isolate inline-flex items-center justify-center overflow-hidden whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-slate-500 hover:text-slate-900 data-[state=active]:text-[#24598e] dark:text-white/55 dark:hover:text-white dark:data-[state=active]:text-white',
        className
      )}
      {...props}
    >
      {isActive && (
        <motion.span
          layoutId={layoutId}
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] border border-white/75 bg-white/[0.74] shadow-[inset_1px_1px_0_rgba(255,255,255,0.95),0_7px_18px_rgba(43,91,138,0.14)] backdrop-blur-2xl dark:border-white/[0.12] dark:bg-white/[0.11] dark:shadow-[inset_1px_1px_0_rgba(255,255,255,0.12),0_9px_22px_rgba(0,0,0,0.28)]"
          transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.72 }}
        />
      )}
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
