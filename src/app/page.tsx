import { Navbar } from "@/components/navbar";
import { Hero } from "@/sections/hero";
import { Trust } from "@/sections/trust";
import { ProblemOpportunity } from "@/sections/problem-opportunity";
import { Workflow } from "@/sections/workflow";
import { Process } from "@/sections/process";
import { WhyReplyFlow } from "@/sections/why-replyflow";
import { Services } from "@/sections/services";
import { TechnologyStack } from "@/sections/technology-stack";
import { CompanyOS } from "@/sections/company-os";
import { CTA } from "@/sections/cta";
import { Footer } from "@/sections/footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Trust />
      <ProblemOpportunity />
      <Workflow />
      <Process />
      <WhyReplyFlow />
      <Services />
      <TechnologyStack />
      <CompanyOS />
      <CTA />
      <Footer />
    </main>
  );
}