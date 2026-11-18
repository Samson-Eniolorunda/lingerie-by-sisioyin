import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/config/site";

export function WhatsAppButton() {
  return (
    <a
      href={whatsappLink("Hello, I have a question about an item on your site.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Message us on WhatsApp"
      data-print="hide"
      data-keyboard-hide
      className="whatsapp-fab flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-md hover:bg-primary-hover hover:text-on-primary"
    >
      <MessageCircle size={24} strokeWidth={1.5} aria-hidden="true" />
    </a>
  );
}
