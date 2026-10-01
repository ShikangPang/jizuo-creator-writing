import { z } from "zod";
import { GenerateVideoMediaInput, ImportVideoAssetInput } from "./media-operations.ts";
export const ChatMediaInput = GenerateVideoMediaInput.pick({kind:true,prompt:true,connectionId:true,aspectRatio:true,durationSeconds:true,referenceAssetIds:true,generationSettings:true}).extend({
 prompt:z.string().trim().min(1).max(32000),
 referenceAttachmentIds:z.array(z.string().min(1).max(256)).max(14).optional(),
}).strict();
export type ChatMediaInput=z.infer<typeof ChatMediaInput>;
export const ChatMediaSessionInput=z.object({sessionId:z.string().min(1).max(128)}).strict();
export const SubmitChatMediaInput = ChatMediaSessionInput.extend({
 requestId: z.string().uuid(),
 generation: ChatMediaInput.omit({ referenceAttachmentIds: true }),
 images: z.array(ImportVideoAssetInput.pick({base64:true,mimeType:true}).extend({id:z.string().min(1).max(256)})).max(14).default([]),
}).strict();
export type SubmitChatMediaInput = z.infer<typeof SubmitChatMediaInput>;
