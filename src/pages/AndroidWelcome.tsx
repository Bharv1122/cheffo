import { Link } from 'react-router-dom';
import { ANDROID_ACCESS_MESSAGE } from '../utils/distribution';

export default function AndroidWelcome() {
  return (
    <main className="min-h-screen bg-[#fffbf5] px-5 py-12">
      <section className="mx-auto max-w-md text-center">
        <img src="/pwa-192.png" alt="Cheffo Doggo" className="mx-auto h-28 w-28 rounded-3xl" />
        <h1 className="mt-5 text-3xl font-semibold text-[#2b2118]">Welcome to Cheffo Doggo</h1>
        <p className="mt-3 text-[#6f6459]">Keep your dog's profiles and homemade recipes together. Review ingredients and meal plans with your veterinarian.</p>
        <p className="mt-4 text-sm text-[#6f6459]">{ANDROID_ACCESS_MESSAGE}</p>
        <div className="mt-7 flex flex-col gap-3">
          <Link to="/login" className="rounded-xl bg-[#a34c11] px-5 py-3 font-semibold text-white">Sign in</Link>
          <Link to="/signup" className="rounded-xl border border-[#d8cec3] bg-white px-5 py-3 font-semibold text-[#2b2118]">Create a free account</Link>
          <Link to="/calculator" className="py-2 text-[#a34c11] underline">Try the portion calculator</Link>
        </div>
        <nav aria-label="Support and legal" className="mt-8 flex justify-center gap-5 text-sm text-[#6f6459]">
          <Link to="/help">Help</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
        </nav>
      </section>
    </main>
  );
}
