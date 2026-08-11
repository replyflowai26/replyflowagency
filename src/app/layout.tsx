import type {Metadata} from "next"; import "./globals.css";
export const metadata:Metadata={title:"ReplyFlow AI | AI Automation",description:"AI automation systems for sales, support, lead generation and operations.",metadataBase:new URL("https://replyflowagency.com")};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}