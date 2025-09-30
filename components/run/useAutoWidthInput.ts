// useAutoWidthInput.ts
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, Ref } from 'react';

type MaybeRef<T> = Ref<T> | undefined;

export interface AutoWidthOptions {
  /** The current input value (what users typed). */
  value: string;
  /** Placeholder to use when value is empty (optional; purely for measurement). */
  placeholder?: string;
  /** Minimum width in "ch" units (converted to px using the font's 0-width). Default 3ch. */
  minCh?: number;
  /** Extra spaces to add at the end for caret breathing room. Default 1. */
  padEndSpaces?: number;
  /** Include the input's horizontal padding & borders in the measurement. Default true. */
  includeInputPadding?: boolean;
  /** Extra pixels you want to add just in case. Default 0. */
  extraPx?: number;
}

/**
 * useAutoWidthInput
 * - Returns a ref to attach to your <input> and a CSS width you can apply.
 * - Measures real rendered text (with kerning/ligatures) via an offscreen mirror <span>.
 * - Reacts to value/placeholder changes, font loads, and responsive font-size (e.g. clamp()).
 */
export function useAutoWidthInput<T extends HTMLInputElement = HTMLInputElement>(
  options: AutoWidthOptions,
  externalRef?: MaybeRef<T>
) {
  const {
    value,
    placeholder = '',
    minCh = 3,
    padEndSpaces = 1,
    includeInputPadding = true,
    extraPx = 0,
  } = options;

  const inputRef = useRef<T | null>(null);
  const sizerRef = useRef<HTMLSpanElement | null>(null);
  const [width, setWidth] = useState<string>(`${Math.max(minCh, 3)}ch`);

  // Helper: forward node to an external ref if provided
  const forwardRef = useCallback((node: T | null) => {
    if (!externalRef) return;
    if (typeof externalRef === 'function') externalRef(node);
    else {
      try {
        (externalRef as { current: T | null }).current = node;
      } catch {
        /* no-op */
      }
    }
  }, [externalRef]);

  // Create and tear down the offscreen sizer once
  useEffect(() => {
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    // Offscreen & non-interactive
    Object.assign(span.style, {
      position: 'absolute',
      top: '-10000px',
      left: '0',
      visibility: 'hidden',
      whiteSpace: 'pre', // preserve spaces
      pointerEvents: 'none',
    } as CSSStyleDeclaration);
    document.body.appendChild(span);
    sizerRef.current = span;

    return () => {
      if (sizerRef.current?.parentNode) {
        sizerRef.current.parentNode.removeChild(sizerRef.current);
      }
      sizerRef.current = null;
    };
  }, []);

  // Copy the essential computed styles from the input to the sizer
  const syncSizerStyles = useCallback(() => {
    const input = inputRef.current;
    const sizer = sizerRef.current;
    if (!input || !sizer) return;

    const cs = getComputedStyle(input);

    // Font & text metrics that affect width
    const propsToCopy: Array<keyof CSSStyleDeclaration> = [
      'fontFamily',
      'fontSize',
      'fontStyle',
      'fontWeight',
      'fontStretch',
      'lineHeight',
      'letterSpacing',
      'textTransform',
      'textIndent',
      'textRendering',
      'fontKerning',
      'fontVariant',
      'fontFeatureSettings',
      'fontVariationSettings',
      'tabSize',
    ];

    propsToCopy.forEach((prop) => {
      // @ts-expect-error CSSStyleDeclaration indexing
      sizer.style[prop] = cs[prop] as any;
    });

    // Match box model so padding/borders can be included if desired
    sizer.style.boxSizing = cs.boxSizing;

    if (includeInputPadding) {
      sizer.style.paddingLeft = cs.paddingLeft;
      sizer.style.paddingRight = cs.paddingRight;
      sizer.style.borderLeftWidth = cs.borderLeftWidth;
      sizer.style.borderRightWidth = cs.borderRightWidth;
      sizer.style.borderLeftStyle = cs.borderLeftStyle;
      sizer.style.borderRightStyle = cs.borderRightStyle;
    } else {
      sizer.style.paddingLeft = sizer.style.paddingRight = '0px';
      sizer.style.borderLeftWidth = sizer.style.borderRightWidth = '0px';
      sizer.style.borderLeftStyle = sizer.style.borderRightStyle = 'none';
    }
  }, [includeInputPadding]);

  // Measure current text width in px (including padding/border if configured)
  const measure = useCallback(() => {
    const input = inputRef.current;
    const sizer = sizerRef.current;
    if (!input || !sizer) return;

    syncSizerStyles();

    // What to measure: actual value or placeholder when empty
    const base = value && value.length ? value : placeholder;
    const text = base + ' '.repeat(Math.max(0, padEndSpaces));
    sizer.textContent = text;

    let px = Math.ceil(sizer.getBoundingClientRect().width);

    // Enforce minCh by measuring that many zeroes with the same font (real "ch")
    if (minCh > 0) {
      sizer.textContent = '0'.repeat(minCh);
      const minPx = Math.ceil(sizer.getBoundingClientRect().width);
      px = Math.max(px, minPx);
    }

    px += extraPx;

    setWidth(`${px}px`);
  }, [value, placeholder, padEndSpaces, minCh, extraPx, syncSizerStyles]);

  // Re-measure on relevant changes
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Re-measure when the element resizes (font-size via clamp(), container changes, etc.)
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(input);

    // Re-measure after webfonts load/swap
    const fonts = (document as any).fonts as FontFaceSet | undefined;
    let onFonts: (() => void) | null = null;

    if (fonts) {
      onFonts = () => measure();
      fonts.ready.then(onFonts).catch(() => {});
      // Some browsers support events:
      // @ts-ignore
      fonts.addEventListener?.('loadingdone', onFonts);
    }

    // Window resize can affect clamp() too
    const onWinResize = () => measure();
    window.addEventListener('resize', onWinResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      if (fonts && onFonts) {
        // @ts-ignore
        fonts.removeEventListener?.('loadingdone', onFonts);
      }
    };
  }, [measure]);

  // Ref to attach to the <input>
  const ref = useCallback((node: T | null) => {
    inputRef.current = node;
    forwardRef(node);
    // Measure immediately when the node appears
    if (node) measure();
  }, [forwardRef, measure]);

  // Handy style object if you want to spread directly into <input style={...}>
  const style = { width };

  return { ref, width, style, measureNow: measure };
}
