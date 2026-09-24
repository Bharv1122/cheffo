import { Link } from 'react-router-dom';
import { ANDROID_ACCESS_MESSAGE } from '../../utils/distribution';

export function AndroidAccess() {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-[#eadfce] bg-white p-6">
      <h1 className="text-2xl font-semibold text-[#2b2118]">Your Cheffo Doggo access</h1>
      <p className="mt-3 text-sm text-[#6f6459]">{ANDROID_ACCESS_MESSAGE}</p>
      <p className="mt-3 text-sm text-[#6f6459]">Sign in with the same account to use your existing access. Your plan status appears in Settings.</p>
      <div className="mt-5 flex flex-wrap gap-4 text-[#a34c11]">
        <Link to="/" className="underline">Home</Link>
        <Link to="/settings" className="underline">Settings</Link>
      </div>
    </section>
  );
}
