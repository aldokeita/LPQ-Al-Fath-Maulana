import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import gsap from 'gsap';
import './CardSwap.css';

export const Card = forwardRef(({ customClass, className = '', ...rest }, ref) => (
  <div ref={ref} {...rest} className={`rb-card-swap__card ${customClass ?? ''} ${className}`.trim()} />
));

Card.displayName = 'Card';

const makeSlot = (index, distanceX, distanceY, total) => ({
  x: index * distanceX,
  y: -index * distanceY,
  z: -index * distanceX * 1.5,
  zIndex: total - index,
});

const placeNow = (element, slot, skew) => {
  if (!element) return;
  gsap.set(element, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true,
  });
};

const getAnimationConfig = (easing) => (
  easing === 'elastic'
    ? {
        ease: 'elastic.out(0.6,0.9)',
        durDrop: 1.8,
        durMove: 1.8,
        durReturn: 1.8,
        promoteOverlap: 0.9,
        returnDelay: 0.05,
      }
    : {
        ease: 'power1.inOut',
        durDrop: 0.72,
        durMove: 0.72,
        durReturn: 0.72,
        promoteOverlap: 0.45,
        returnDelay: 0.2,
      }
);

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
);

const CardSwap = ({
  width = 520,
  height = 430,
  cardDistance = 56,
  verticalDistance = 58,
  delay = 5200,
  pauseOnHover = true,
  onCardClick,
  skewAmount = 4,
  easing = 'elastic',
  children,
  className = '',
}) => {
  const config = useMemo(() => getAnimationConfig(easing), [easing]);
  const childArray = useMemo(() => Children.toArray(children).filter(Boolean), [children]);
  const refs = useMemo(
    () => childArray.map(() => React.createRef()),
    [childArray.length],
  );
  const order = useRef(Array.from({ length: childArray.length }, (_, index) => index));
  const timelineRef = useRef(null);
  const intervalRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const total = refs.length;
    order.current = Array.from({ length: total }, (_, index) => index);

    refs.forEach((ref, index) => {
      placeNow(ref.current, makeSlot(index, cardDistance, verticalDistance, total), skewAmount);
    });

    if (total < 2 || prefersReducedMotion()) return undefined;

    const swap = () => {
      if (order.current.length < 2) return;

      const [front, ...rest] = order.current;
      const frontElement = refs[front]?.current;
      if (!frontElement) return;

      timelineRef.current?.kill();
      const timeline = gsap.timeline();
      timelineRef.current = timeline;

      timeline.to(frontElement, {
        y: '+=520',
        duration: config.durDrop,
        ease: config.ease,
      });

      timeline.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`);
      rest.forEach((index, slotIndex) => {
        const element = refs[index]?.current;
        const slot = makeSlot(slotIndex, cardDistance, verticalDistance, refs.length);
        if (!element) return;

        timeline.set(element, { zIndex: slot.zIndex }, 'promote');
        timeline.to(
          element,
          {
            x: slot.x,
            y: slot.y,
            z: slot.z,
            duration: config.durMove,
            ease: config.ease,
          },
          `promote+=${slotIndex * 0.12}`,
        );
      });

      const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length);
      timeline.addLabel('return', `promote+=${config.durMove * config.returnDelay}`);
      timeline.call(() => {
        gsap.set(frontElement, { zIndex: backSlot.zIndex });
      }, undefined, 'return');
      timeline.to(
        frontElement,
        {
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
          duration: config.durReturn,
          ease: config.ease,
        },
        'return',
      );
      timeline.call(() => {
        order.current = [...rest, front];
      });
    };

    const startInterval = () => {
      window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(swap, delay);
    };
    const stopInterval = () => {
      window.clearInterval(intervalRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        timelineRef.current?.pause();
        stopInterval();
      } else {
        timelineRef.current?.play();
        startInterval();
      }
    };

    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const node = containerRef.current;
    if (pauseOnHover && node) {
      node.addEventListener('mouseenter', stopInterval);
      node.addEventListener('mouseleave', startInterval);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pauseOnHover && node) {
        node.removeEventListener('mouseenter', stopInterval);
        node.removeEventListener('mouseleave', startInterval);
      }
      stopInterval();
      timelineRef.current?.kill();
    };
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, config, refs]);

  const renderedCards = childArray.map((child, index) => (
    isValidElement(child)
      ? cloneElement(child, {
          key: child.key ?? index,
          ref: refs[index],
          style: { width, height, ...(child.props.style ?? {}) },
          onClick: (event) => {
            child.props.onClick?.(event);
            onCardClick?.(index);
          },
        })
      : child
  ));

  return (
    <div ref={containerRef} className={`rb-card-swap ${className}`.trim()} style={{ width, height }}>
      {renderedCards}
    </div>
  );
};

export default CardSwap;
