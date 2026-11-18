"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { ProductImage } from "@/types/domain";
import { ZoomViewer } from "./ZoomViewer";

/**
 * Phones: a native scroll-snap strip, one 4:5 image per snap, with a counter. From 768 px the same
 * images show with a thumbnail column. A tap opens the full-screen viewer.
 */
export function Gallery({
  images,
  name,
}: {
  readonly images: readonly ProductImage[];
  readonly name: string;
}) {
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const strip = useRef<HTMLUListElement>(null);

  function onScroll() {
    const el = strip.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }
  function show(next: number) {
    const el = strip.current;
    setIndex(next);
    el?.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="md:grid md:grid-cols-[5rem_1fr] md:gap-4">
      {images.length > 1 ? (
        <ul className="hidden flex-col gap-2 md:flex" aria-label="Thumbnails">
          {images.map((image, i) => (
            <li key={image.src + i}>
              <button
                type="button"
                aria-label={`Show photograph ${i + 1} of ${images.length}`}
                aria-current={i === index}
                onClick={() => show(i)}
                className={cn(
                  "relative block aspect-[4/5] w-full overflow-hidden bg-tint outline-offset-2",
                  i === index ? "ring-2 ring-primary" : "",
                )}
              >
                <Image
                  src={image.src}
                  alt=""
                  fill
                  sizes="80px"
                  unoptimized={image.src.endsWith(".svg")}
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <ul
          ref={strip}
          onScroll={onScroll}
          aria-label={`${name} photographs`}
          className="flex snap-x snap-mandatory scrollbar-none overflow-x-auto"
        >
          {images.map((image, i) => (
            <li key={image.src + i} className="w-full shrink-0 snap-center">
              <button
                type="button"
                onClick={() => setViewer(true)}
                aria-label="Open photograph full screen"
                className="relative block aspect-[4/5] w-full bg-tint"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  priority={i === 0}
                  loading={i === 0 ? "eager" : "lazy"}
                  sizes="(max-width: 767px) 100vw, 50vw"
                  unoptimized={image.src.endsWith(".svg")}
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
        {images.length > 1 ? (
          <p
            aria-live="polite"
            className="tabular absolute right-3 bottom-3 rounded-sm bg-surface px-2 py-1 text-sm shadow-sm"
          >
            {index + 1} / {images.length}
          </p>
        ) : null}
      </div>

      <ZoomViewer
        images={images}
        index={index}
        onIndexChange={show}
        open={viewer}
        onOpenChange={setViewer}
      />
    </div>
  );
}
