import type { ChatAttachment } from "./mockData";

export function persistableAttachment(attachment: ChatAttachment): ChatAttachment {
  if (attachment.url?.startsWith("blob:")) {
    const { url: _url, ...rest } = attachment;
    return rest;
  }
  return attachment;
}
