"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState } from "react";
import type { ProductImage } from "@/types/domain";

const MAX_SCALE = 4;

/**
 * Full-screen viewer: swipe between images, pinch to zoom, double-tap for 2x, drag to pan while zoomed.
 * Gestures use pointer events with `touch-action: none` on the image, so page zoom is untouched elsewhere.
 */
export function ZoomViewer({
  images,
  index,
  onIndexChange,
  open,
  onOpenChange,
}: {
  readonly images: readonly ProductImage[];
  readonly index: number;
  readonly onIndexChange: (index: number) => void;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    startDistance: 0,
    startScale: 1,
    lastTap: 0,
    swipeStart: 0,
    panStart: { x: 0, y: 0 },
  });
  const image = images[index];

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const go = (step: number) => {
    reset();
    onIndexChange((index + step + images.length) % images.length);
  };

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) g.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
      g.startScale = scale;
    } else {
      g.swipeStart = event.clientX;
      g.panStart = { x: event.clientX - offset.x, y: event.clientY - offset.y };
      const now = Date.now();
      if (now - g.lastTap < 300) {
        if (scale > 1) reset();
        else setScale(2);
      }
      g.lastTap = now;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b && g.startDistance > 0) {
        const next = (Math.hypot(a.x - b.x, a.y - b.y) / g.startDistance) * g.startScale;
        setScale(Math.min(MAX_SCALE, Math.max(1, next)));
      }
    } else if (scale > 1) {
      setOffset({ x: event.clientX - g.panStart.x, y: event.clientY - g.panStart.y });
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(event.pointerId);
    if (wasSingle && scale === 1 && images.length > 1) {
      const dx = event.clientX - gesture.current.swipeStart;
      if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    }
    if (scale <= 1.02) reset();
  }

  const iconButton =
    "absolute z-10 flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-md";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-sheet)] bg-footer" />
        <Dialog.Content className="fixed inset-0 z-[calc(var(--z-sheet)+1)] outline-none">
          <Dialog.Title className="sr-only">Product photographs</Dialog.Title>
          <Dialog.Description className="sr-only">
            Swipe to change photograph. Pinch or double-tap to zoom.
          </Dialog.Description>
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close"
              className={`${iconButton} right-4`}
              style={{ top: "calc(var(--safe-top) + 12px)" }}
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </Dialog.Close>
          <p
            className="tabular absolute left-4 z-10 rounded-sm bg-surface px-2 py-1 text-sm"
            style={{ top: "calc(var(--safe-top) + 16px)" }}
          >
            {index + 1} / {images.length}
          </p>
          <div
            className="absolute inset-0 touch-none overflow-hidden"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {image ? (
              <div
                className="absolute inset-0 transition-transform duration-100"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="100vw"
                  unoptimized={image.src.endsWith(".svg")}
                  className="object-contain"
                  draggable={false}
                />
              </div>
            ) : null}
          </div>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous photograph"
                onClick={() => go(-1)}
                className={`${iconButton} top-1/2 left-3 -translate-y-1/2`}
              >
                <ChevronLeft size={22} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label="Next photograph"
                onClick={() => go(1)}
                className={`${iconButton} top-1/2 right-3 -translate-y-1/2`}
              >
                <ChevronRight size={22} strokeWidth={1.5} />
              </button>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
