import type {
  Category,
  ColourEntry,
  Gender,
  Product,
  ProductImage,
  SizeEntry,
  VariantStock,
} from "@/types/domain";

/**
 * Development fixtures. These are invented products with clearly marked placeholder pictures, used
 * until the catalogue is read from the shop's database (which needs the live schema; see
 * REBUILD_STATUS.md). They are never shown as real stock.
 */

const placeholder = (n: 1 | 2 | 3, name: string): ProductImage => ({
  src: `/placeholders/product-${n}.svg`,
  alt: `Placeholder image for ${name}. The photograph is to follow.`,
  width: 800,
  height: 1000,
});

interface Seed {
  readonly slug: string;
  readonly name: string;
  readonly category: Category;
  readonly gender: Gender;
  readonly priceNgn: number;
  readonly description: string;
  readonly sizes: readonly string[];
  readonly colours: readonly string[];
  readonly isNew?: boolean;
  readonly packType?: string;
  readonly deliveryType?: "standard" | "express";
  readonly stock: (size: string, colour: string, index: number) => number;
  readonly rating?: readonly [number, number];
  readonly images?: 1 | 2 | 3;
}

const seeds: readonly Seed[] = [
  {
    slug: "lace-balconette-bra",
    name: "Lace balconette bra",
    category: "Lingerie",
    gender: "Women",
    priceNgn: 18500,
    description:
      "A lightly lined balconette in soft stretch lace, with adjustable straps and a smooth back band.",
    sizes: ["32B", "34B", "34C", "36C", "36D"],
    colours: ["Black", "Nude", "Wine"],
    isNew: true,
    stock: (_s, _c, i) => (i % 5 === 0 ? 0 : 6),
    rating: [4.6, 18],
    images: 3,
  },
  {
    slug: "cotton-high-waist-brief",
    name: "Cotton high-waist brief",
    category: "Underwear",
    gender: "Women",
    priceNgn: 6500,
    description: "Breathable cotton with a soft waistband that stays flat under fitted clothes.",
    sizes: ["S", "M", "L", "XL"],
    colours: ["Black", "Nude", "White"],
    stock: (s) => (s === "XL" ? 2 : 500),
    rating: [4.8, 41],
    images: 2,
  },
  {
    slug: "satin-slip-nightdress",
    name: "Satin slip nightdress with a very long product name to test wrapping",
    category: "Loungewear",
    gender: "Women",
    priceNgn: 32000,
    description:
      "A bias-cut satin slip that falls to the knee, finished with narrow adjustable straps.",
    sizes: ["S", "M", "L"],
    colours: ["Champagne", "Wine"],
    isNew: true,
    stock: () => 3,
    rating: [4.4, 9],
    images: 3,
  },
  {
    slug: "ribbed-lounge-set",
    name: "Ribbed lounge set",
    category: "Loungewear",
    gender: "Women",
    priceNgn: 28500,
    description: "A soft ribbed top and trousers, made to be worn at home and for a quick errand.",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    colours: [
      "Oatmeal",
      "Charcoal",
      "Sage",
      "Black",
      "Wine",
      "Cream",
      "Navy",
      "Rust",
      "Stone",
      "Olive",
    ],
    stock: (_s, _c, i) => (i % 7 === 0 ? 0 : 5),
    rating: [4.7, 27],
    images: 2,
  },
  {
    slug: "everyday-t-shirt-bra",
    name: "Everyday T-shirt bra",
    category: "Lingerie",
    gender: "Women",
    priceNgn: 15000,
    description: "A seamless moulded cup that stays smooth under knitwear.",
    sizes: ["32A", "32B", "34B", "34C", "36B", "36C", "38D"],
    colours: ["Nude", "Black"],
    stock: () => 8,
    rating: [4.5, 33],
    images: 1,
  },
  {
    slug: "mens-cotton-boxer-pack",
    name: "Men's cotton boxer, 3-in-1",
    category: "Underwear",
    gender: "Men",
    priceNgn: 14000,
    description: "Three cotton boxers in assorted colours, with a flat waistband and a roomy leg.",
    sizes: ["S", "M", "L", "XL"],
    colours: [],
    packType: "3-in-1",
    stock: () => 10,
    rating: [4.3, 12],
    images: 1,
  },
  {
    slug: "mens-lounge-shorts",
    name: "Men's lounge shorts",
    category: "Loungewear",
    gender: "Men",
    priceNgn: 12500,
    description: "Brushed cotton shorts with a drawstring waist and side pockets.",
    sizes: ["M", "L", "XL"],
    colours: ["Grey", "Navy"],
    isNew: true,
    stock: (s) => (s === "M" ? 0 : 4),
    rating: [0, 0],
    images: 2,
  },
  {
    slug: "girls-cotton-vest-set",
    name: "Girls' cotton vest set",
    category: "Underwear",
    gender: "Kids",
    priceNgn: 7500,
    description: "Soft cotton vests with a plain finish, sold as a set of two.",
    sizes: ["4-5y", "6-7y", "8-9y"],
    colours: ["White", "Pink"],
    packType: "2-in-1",
    stock: () => 9,
    rating: [4.9, 6],
    images: 1,
  },
  {
    slug: "boys-cotton-brief-set",
    name: "Boys' cotton brief set",
    category: "Underwear",
    gender: "Kids",
    priceNgn: 7000,
    description: "Plain cotton briefs for school and play, sold as a set of three.",
    sizes: ["4-5y", "6-7y", "8-9y"],
    colours: [],
    packType: "3-in-1",
    stock: () => 12,
    rating: [4.2, 4],
    images: 1,
  },
  {
    slug: "silk-sleep-eye-mask",
    name: "Silk sleep eye mask",
    category: "Accessories",
    gender: "Unisex",
    priceNgn: 5500,
    description: "A soft mask with an adjustable band, packed in its own pouch.",
    sizes: ["One Size"],
    colours: ["Wine", "Black"],
    stock: () => 20,
    rating: [4.6, 15],
    images: 1,
  },
  {
    slug: "bodysuit-scoop-neck",
    name: "Scoop-neck bodysuit",
    category: "Lingerie",
    gender: "Women",
    priceNgn: 21000,
    description: "A stretch bodysuit with a snap closure and a smooth scoop neckline.",
    sizes: ["XS", "S", "M", "L", "XL"],
    colours: ["Black", "Nude"],
    isNew: true,
    stock: (_s, c) => (c === "Nude" ? 2 : 7),
    rating: [4.5, 21],
    images: 2,
  },
  {
    slug: "lace-trim-camisole",
    name: "Lace-trim camisole",
    category: "Lingerie",
    gender: "Women",
    priceNgn: 13500,
    description: "A short camisole in stretch jersey with a narrow lace trim.",
    sizes: ["S", "M", "L"],
    colours: ["Ivory", "Wine"],
    stock: () => 0,
    rating: [4.1, 7],
    images: 1,
  },
  {
    slug: "bamboo-seamless-brief-pack",
    name: "Bamboo seamless brief, 3-in-1",
    category: "Underwear",
    gender: "Women",
    priceNgn: 16500,
    description: "Three seamless briefs in soft bamboo blend, in assorted colours.",
    sizes: ["S", "M", "L", "XL"],
    colours: [],
    packType: "3-in-1",
    stock: () => 11,
    rating: [4.7, 30],
    images: 1,
  },
];

function build(seed: Seed, order: number): Product {
  const sizes: SizeEntry[] = seed.sizes.map((name, i) =>
    seed.colours.length === 0 ? { name, qty: seed.stock(name, "", i) } : { name },
  );
  const colours: ColourEntry[] = seed.colours.map((name) => ({ name }));
  const variantStock: VariantStock[] = [];
  let index = 0;
  for (const size of seed.sizes) {
    if (seed.colours.length === 0) {
      variantStock.push({ size, color: "", qty: seed.stock(size, "", index++) });
    } else {
      for (const color of seed.colours)
        variantStock.push({ size, color, qty: seed.stock(size, color, index++) });
    }
  }
  const total = variantStock.reduce((n, v) => n + v.qty, 0);
  const count = seed.images ?? 1;
  const images = ([1, 2, 3] as const).slice(0, count).map((n) => placeholder(n, seed.name));
  const [avg, reviews] = seed.rating ?? [0, 0];
  return {
    id: `fixture-${String(order + 1).padStart(2, "0")}`,
    slug: seed.slug,
    name: seed.name,
    category: seed.category,
    gender: seed.gender,
    priceNgn: seed.priceNgn,
    qty: total,
    sizes,
    colours,
    variantStock: seed.colours.length === 0 ? [] : variantStock,
    description: seed.description,
    images,
    isNew: seed.isNew ?? false,
    allowColourSelection: seed.colours.length > 0 && seed.packType === undefined,
    deliveryType: seed.deliveryType ?? "standard",
    packType: seed.packType ?? "Single",
    avgRating: avg,
    reviewCount: reviews,
    createdAt: new Date(Date.UTC(2026, 10, 18 - order)).toISOString(),
  };
}

export const FIXTURE_PRODUCTS: readonly Product[] = seeds.map(build);
