import Image from "next/image";
import type { ProductImage as ProductImageData } from "@/types/domain";
import { cn } from "@/lib/cn";

/** A fixed 4:5 frame so nothing shifts while the image loads; the frame sits on a nude placeholder. */
export function ProductImage({
  image,
  sizes,
  priority,
  className,
}: {
  readonly image: ProductImageData | undefined;
  readonly sizes: string;
  readonly priority?: boolean;
  readonly className?: string;
}) {
  return (
    <div className={cn("relative aspect-[4/5] w-full overflow-hidden bg-tint", className)}>
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority ?? false}
          unoptimized={image.src.endsWith(".svg")}
          className="object-cover"
        />
      ) : null}
    </div>
  );
}
