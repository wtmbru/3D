"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";

export function CartHydrator() {
  useEffect(() => {
    useCart.persist.rehydrate();
  }, []);
  return null;
}
