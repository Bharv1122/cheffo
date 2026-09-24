// Synthetic browser fixture: real providers/hooks; Supabase is intercepted locally.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { AccountScope } from '../src/components/auth/AccountScope';
import { usePaywall } from '../src/hooks/usePaywall';
import { useRecipes } from '../src/hooks/useRecipes';
import { useDogProfiles } from '../src/hooks/useDogProfiles';
import TreatsPage from '../src/pages/Treats';

declare global {interface Window { __continueNavigation: () => void; }}
// eslint-disable-next-line react-refresh/only-export-components -- standalone synthetic browser fixture.
function Probe() {
  const {user, loading:authLoading}=useAuth();
  const access=usePaywall();
  const {recipes,loading:recipesLoading}=useRecipes();
  const {profiles,loading:profilesLoading,updateProfile}=useDogProfiles();
  const navigate=useNavigate();
  const location=useLocation();
  async function pendingNavigation() {
    await new Promise<void>(resolve=>{window.__continueNavigation=resolve;});
    navigate('/signed-in-destination');
  }
  return <><pre id="snapshot">{JSON.stringify({user:user?.id??null,authLoading,
    premium:access.isPremium,accessLoading:access.isLoading,
    treatAllowed:access.canUseFeature('treat'),remaining:access.treatRecipesRemaining,
    recipes:recipes.map(x=>x.name),recipesLoading,profiles:profiles.map(x=>x.name),profilesLoading,path:location.pathname})}</pre>
    <button onClick={()=>void pendingNavigation()}>Pending sign-in navigation</button>
    <button onClick={()=>void updateProfile(profiles[0].id,{name:'Renamed dog'})}>Rename only</button>
    <button onClick={()=>void updateProfile(profiles[0].id,{idealWeightLbs:undefined})}>Clear ideal weight</button></>;
}
createRoot(document.getElementById('root')!).render(<AuthProvider><BrowserRouter><AccountScope>{new URLSearchParams(location.search).has('treats')?<TreatsPage/>:<Probe/>}</AccountScope></BrowserRouter></AuthProvider>);
