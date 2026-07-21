import React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({
  className,
  type,
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const inputRef = React.useRef(null);
  const isControlledNumber = type === 'number' && value !== undefined;
  const [numberDraft, setNumberDraft] = React.useState(isControlledNumber ? String(value ?? '') : '');
  const [numberFocused, setNumberFocused] = React.useState(false);

  React.useImperativeHandle(ref, () => inputRef.current);

  React.useEffect(() => {
    if (isControlledNumber && !numberFocused) {
      setNumberDraft(String(value ?? ''));
    }
  }, [isControlledNumber, numberFocused, value]);

  const handleFocus = (event) => {
    setNumberFocused(true);
    if (isControlledNumber && Number(value) === 0) {
      event.currentTarget.select();
    }
    onFocus?.(event);
  };

  const handleChange = (event) => {
    if (isControlledNumber) setNumberDraft(event.target.value);
    onChange?.(event);
  };

  const handleBlur = (event) => {
    setNumberFocused(false);
    onBlur?.(event);
  };

  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-xl border border-input bg-background/90 px-3 py-2 text-sm ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        'dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:placeholder:text-white/35 dark:focus-visible:border-white/25 dark:focus-visible:ring-white/25',
        className
      )}
      ref={inputRef}
      value={isControlledNumber ? numberDraft : value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
