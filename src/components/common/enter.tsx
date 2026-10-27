import { cn } from '@/lib/utils';

export type EnterVariant = 'sink' | 'reveal' | 'ring' | 'pop' | 'card';

/**
 * The classes and delay that bring something in, played by the browser (see
 * .enter in globals.css), so it doesn't wait for the page's JavaScript.
 * `sink` settles from above, `reveal` rises, `ring` grows into place, `pop`
 * grows with a wobble, `card` tips up. `spring: 'pop'` gives any of them the
 * bouncier spring.
 */
export function enter(variant: EnterVariant, delay = 0, { spring }: { spring?: 'pop' } = {}) {
  return {
    className: cn('enter', `enter-${variant}`, spring === 'pop' && 'spring-pop'),
    style: { '--enter-delay': `${delay}s` } as React.CSSProperties,
  };
}

/** An element coming in (see enter), after `delay` seconds. */
export function Enter({
  as: Tag = 'div',
  variant,
  delay = 0,
  spring,
  className,
  children,
  ...props
}: {
  as?: 'div' | 'span' | 'h1' | 'p';
  variant: EnterVariant;
  delay?: number;
  spring?: 'pop';
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children' | 'style'>) {
  const { className: enterClassName, style } = enter(variant, delay, { spring });

  return (
    <Tag className={cn(enterClassName, className)} style={style} {...props}>
      {children}
    </Tag>
  );
}
