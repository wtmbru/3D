"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while the page is being server-rendered and until React takes over in
 * the browser. Use it to keep a submit button disabled until then: before that,
 * the form's own JavaScript isn't attached yet, and the browser would submit it
 * the old-fashioned way, putting what people typed (name, email, phone) in the
 * web address.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
