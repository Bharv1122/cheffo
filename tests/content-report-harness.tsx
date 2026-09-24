import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { ReportContentButton } from '../src/components/reports/ReportContentButton';
import '../src/index.css';
export function Probe(){
 const {user}=useAuth();
 return <main className="p-4"><p id="identity">{user?.id??'signed-out'}</p>
  <ReportContentButton label="Report recipe" target={{source:'recipe',recipeId:'11111111-1111-4111-8111-111111111111'}}/>
  <ReportContentButton label="Report image" target={{source:'image',recipeId:'11111111-1111-4111-8111-111111111111'}}/>
  <ReportContentButton label="Report reply" target={{source:'chat',message:'Synthetic assistant reply'}}/>
  <ReportContentButton label="Report long reply" target={{source:'chat',message:'x'.repeat(15999)+'🙂'.repeat(500)}}/>
 </main>;
}
createRoot(document.getElementById('root')!).render(<AuthProvider><Probe/></AuthProvider>);
