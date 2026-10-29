import Image from "next/image";

const SIZES = {
  shelf: { px: 72, className: "size-[4.5rem]" },
  cart: { px: 40, className: "size-10" },
} as const;

export function ProductThumb({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: keyof typeof SIZES;
}) {
  const spec = SIZES[size];
  return (
    <Image
      src={src}
      alt={alt}
      width={spec.px}
      height={spec.px}
      loading="eager"
      className={`${spec.className} shrink-0 rounded-md object-cover ring-1 ring-foreground/10`}
    />
  );
}
