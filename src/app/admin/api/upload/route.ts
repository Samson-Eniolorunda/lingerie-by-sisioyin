import { NextResponse } from "next/server";
import { staffFor } from "@/server/auth/session";
import { uploadProductImage } from "@/server/media/cloudinary";

/** Under /admin so the staff cookie (scoped to that path) is sent. Staff with product rights only. */
export async function POST(request: Request): Promise<NextResponse> {
  const actor = await staffFor("products.manage");
  if (!actor)
    return NextResponse.json({ ok: false, message: "Your session has ended." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ ok: false, message: "Choose a photograph." }, { status: 400 });
  const result = await uploadProductImage({
    name: file.name,
    type: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
