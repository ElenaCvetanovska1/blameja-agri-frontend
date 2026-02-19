import { useEffect } from "react";

export const useOutsideClick = <T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onOutside: () => void
) => {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onOutside();
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ref, onOutside]);
}
