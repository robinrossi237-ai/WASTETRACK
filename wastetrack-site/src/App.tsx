import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import Collectors from "./components/Collectors";
import RewardsPlans from "./components/RewardsPlans";
import Education from "./components/Education";
import Stats from "./components/Stats";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import Download from "./components/Download";
import Footer from "./components/Footer";

export default function App() {
  return (
    <main className="font-sans">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <Collectors />
      <RewardsPlans />
      <Education />
      <Stats />
      <Testimonials />
      <FAQ />
      <Download />
      <Footer />
    </main>
  );
}