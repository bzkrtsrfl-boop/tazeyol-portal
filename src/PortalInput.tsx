import React, { useEffect, useRef, useState } from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  /** live: liste filtresi (150ms). blur: saha/para girişi, üst sayfa her tuşta çizilmez. */
  commit?: 'blur' | 'live';
};

export default function PortalInput({ value, onChange, onBlur, onFocus, onKeyDown, commit = 'blur', ...rest }: Props) {
  const [text, setText] = useState(String(value ?? ''));
  const focused = useRef(false);
  const lastSent = useRef(String(value ?? ''));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (focused.current) return;
    const v = String(value ?? '');
    setText(v);
    lastSent.current = v;
  }, [value]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const fire = (v: string) => {
    if (!onChange || v === lastSent.current) return;
    lastSent.current = v;
    onChange({ target: { value: v } } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <input
      {...rest}
      value={text}
      onFocus={e => {
        focused.current = true;
        onFocus?.(e);
      }}
      onChange={e => {
        const v = e.target.value;
        setText(v);
        if (commit !== 'live' || !onChange) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => fire(v), 150);
      }}
      onKeyDown={e => {
        onKeyDown?.(e);
        if (e.key === 'Enter') fire(text);
      }}
      onBlur={e => {
        focused.current = false;
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        fire(text);
        onBlur?.(e);
      }}
    />
  );
}
