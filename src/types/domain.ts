export type Category = "Lingerie" | "Loungewear" | "Underwear" | "Accessories";
export type Gender = "Women" | "Men" | "Kids" | "Unisex";
export type DeliveryType = "standard" | "express";

export interface SizeEntry {
  readonly name: string;
  readonly qty?: number;
}

export interface ColourEntry {
  readonly name: string;
  readonly qty?: number;
}

export interface VariantStock {
  readonly size: string;
  readonly color: string;
  readonly qty: number;
}

export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: Category;
  readonly gender: Gender;
  readonly priceNgn: number;
  readonly qty: number;
  readonly sizes: readonly SizeEntry[];
  readonly colours: readonly ColourEntry[];
  readonly variantStock: readonly VariantStock[];
  readonly description: string;
  readonly images: readonly ProductImage[];
  readonly isNew: boolean;
  readonly allowColourSelection: boolean;
  readonly deliveryType: DeliveryType;
  readonly packType: string;
  readonly avgRating: number;
  readonly reviewCount: number;
  readonly createdAt: string;
}

export interface ProductImage {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

/** A bag line, stored under `LBS_CART_V1` in the shape the live site already writes. */
export interface CartLine {
  readonly variantId: string;
  readonly id: string;
  readonly name: string;
  readonly price_ngn: number;
  readonly selectedSize: string;
  readonly selectedColor: string;
  readonly image: string;
  readonly qty: number;
}
