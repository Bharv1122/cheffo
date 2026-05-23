import { useEffect, useRef, useState } from 'react';
import { storageGet, storageSet } from '../utils/storage';

// Debounce localStorage writes so high-frequency setValue calls (e.g. SSE
// streaming chat appending tokens N times a second — CHE-7) don't serialize
// + write the whole value on every keystroke. The component-state update is
// still synchronous; only the side-effect of persisting is delayed.
const PERSIST_DEBOUNCE_MS = 200;

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Hold initialValue in a ref so the key-change effect below can use the
  // first-render default without listing initialValue in its deps (callers
  // commonly pass inline `[]`/`{}` literals that change identity every render).
  const initialValueRef = useRef(initialValue);

  const [value, setValue] = useState<T>(() => {
    const stored = storageGet<T>(key);
    return stored !== null ? stored : initialValue;
  });

  useEffect(() => {
    const stored = storageGet<T>(key);
    setValue(stored !== null ? stored : initialValueRef.current);
  }, [key]);

  // Latest-value ref so the unmount flush below can write the final value
  // without taking `value` as a dep (which would re-run the unmount effect
  // on every change).
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const id = setTimeout(() => storageSet(key, value), PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [key, value]);

  // On unmount (or key change), force-flush the latest value so streaming
  // updates that haven't crossed the debounce window aren't lost.
  useEffect(() => {
    return () => storageSet(key, valueRef.current);
  }, [key]);

  return [value, setValue] as const;
}
