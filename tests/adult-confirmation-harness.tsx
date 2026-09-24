import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { AccountScope } from '../src/components/auth/AccountScope';
import { buildAdultAiHeaders } from '../src/lib/adultConfirmation';
import SignupPage from '../src/pages/Auth/Signup';
import '../src/index.css';
export function Probe(){
 const {user}=useAuth();const[result,setResult]=useState('idle');
 return <><p id="identity">{user?.id??'signed-out'}</p><p>Saved recipe remains available</p><button onClick={()=>{void buildAdultAiHeaders().then(headers=>fetch('/api/llm',{method:'POST',headers,body:'{}'})).then(()=>setResult('AI requested')).catch(error=>setResult(error.message));}}>Try AI</button><p id="result">{result}</p></>;
}
createRoot(document.getElementById('root')!).render(<AuthProvider><BrowserRouter><AccountScope><Routes><Route path="/signup" element={<SignupPage/>}/><Route path="*" element={<Probe/>}/></Routes></AccountScope></BrowserRouter></AuthProvider>);
