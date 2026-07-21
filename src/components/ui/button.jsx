import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

const buttonVariants = cva(
	'lpq-shiny-button inline-flex items-center justify-center rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] hover:shadow-md dark:shadow-inner dark:shadow-white/10',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-primary/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:border dark:border-white/10',
				destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-destructive/20',
				outline:
          'border border-input bg-background/80 hover:border-primary/40 hover:bg-white/70 hover:text-foreground dark:border-white/10 dark:bg-white/[0.035] dark:text-white dark:hover:border-cyan-300/25 dark:hover:bg-white/10 dark:hover:text-white',
				secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm dark:bg-white/10 dark:text-white dark:hover:bg-white/15',
				ghost: 'hover:bg-white/65 hover:text-foreground dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white',
				link: 'text-primary underline-offset-4 hover:underline shadow-none hover:shadow-none active:scale-100',
        gradient: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-purple-500/20 border-0',
			},
			size: {
				default: 'h-10 px-5 py-2.5',
				sm: 'h-9 rounded-lg px-3 text-xs',
				lg: 'h-12 rounded-xl px-8 text-base',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';
	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			ref={ref}
			{...props}
		/>
	);
});
Button.displayName = 'Button';

export { Button, buttonVariants };
