import type {Metadata} from "next"; import "./globals.css";
// Nonce-based CSP is applied per-request in src/proxy.ts. Next.js can only
// mirror the nonce onto the inline bootstrap scripts (self.__next_f.push) when
// a page is rendered per request, so every route opts into dynamic rendering.
// A statically prerendered page has no request headers and would ship inline
// scripts without the nonce, which the strict script-src policy would block.
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"ReplyFlow AI | AI Automation",description:"AI automation systems for sales, support, lead generation and operations.",metadataBase:new URL("https://replyflowagency.com")};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}