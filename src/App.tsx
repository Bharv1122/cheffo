import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/layout/BottomNav';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

const Login = lazy(() => import('./pages/Auth/Login'));
const Signup = lazy(() => import('./pages/Auth/Signup'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));

const Home = lazy(() => import('./pages/Home'));
const DogProfiles = lazy(() => import('./pages/DogProfiles'));
const NewProfile = lazy(() => import('./pages/DogProfiles/NewProfile'));
const EditProfile = lazy(() => import('./pages/DogProfiles/EditProfile'));
const Recipes = lazy(() => import('./pages/Recipes'));
const RecipeDetail = lazy(() => import('./pages/Recipes/RecipeDetail'));
const BowlBuilder = lazy(() => import('./pages/BowlBuilder'));
const PantryMode = lazy(() => import('./pages/PantryMode'));
const Treats = lazy(() => import('./pages/Treats'));
const Calculator = lazy(() => import('./pages/Calculator'));
const Assistant = lazy(() => import('./pages/Assistant'));
const CookingMode = lazy(() => import('./pages/CookingMode'));
const VetExport = lazy(() => import('./pages/VetExport'));
const VetApprove = lazy(() => import('./pages/VetApprove'));
const Settings = lazy(() => import('./pages/Settings'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Help = lazy(() => import('./pages/Help'));
const Privacy = lazy(() => import('./pages/Legal/Privacy'));
const Terms = lazy(() => import('./pages/Legal/Terms'));
const Landing = lazy(() => import('./pages/Landing'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FFFBF5]">
      <div className="w-16 h-16 rounded-full bg-[#F97316] flex items-center justify-center text-2xl animate-bounce">
        🐾
      </div>
      <p className="text-[#78716C] text-sm">Loading…</p>
    </div>
  );
}

// Root route: marketing landing for unauthenticated visitors, in-app Home
// for signed-in users. Same URL (/), different content based on session
// state — standard SaaS pattern. (CHE-52)
function RootRoute() {
  const { isAuthenticated, isSupabaseEnabled, loading } = useAuth();
  // When Supabase isn't configured (e.g. local dev without env), fall back
  // to the in-app Home — ProtectedRoute does the same.
  if (!isSupabaseEnabled) return <Home />;
  if (loading) return <LoadingFallback />;
  return isAuthenticated ? <Home /> : <Landing />;
}

const NO_BOTTOM_NAV_PREFIXES = ['/cook/', '/vet-export/', '/vet-approve/', '/privacy', '/terms'];
// Routes that don't render the in-app header / bottom nav — landing and legal
// pages have their own marketing chrome. The Home page at `/` also doesn't
// (its layout is special); RootRoute switches between Landing and Home.
const AUTH_PATHS = ['/login', '/signup', '/reset-password', '/vet-approve/', '/privacy', '/terms'];

function AppLayout() {
  const location = useLocation();

  const isAuthPath = AUTH_PATHS.some(path => location.pathname.startsWith(path));
  const showBottomNav =
    !isAuthPath &&
    !NO_BOTTOM_NAV_PREFIXES.some(prefix => location.pathname.startsWith(prefix)) &&
    location.pathname !== '/';

  return (
    <>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/vet-approve/:token" element={<VetApprove />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          <Route path="/" element={<RootRoute />} />
          <Route
            path="/profiles"
            element={
              <ProtectedRoute>
                <DogProfiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profiles/new"
            element={
              <ProtectedRoute>
                <NewProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profiles/:id/edit"
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes"
            element={
              <ProtectedRoute>
                <Recipes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes/:id"
            element={
              <ProtectedRoute>
                <RecipeDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bowl-builder"
            element={
              <ProtectedRoute>
                <BowlBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pantry"
            element={
              <ProtectedRoute>
                <PantryMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/treats"
            element={
              <ProtectedRoute>
                <Treats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calculator"
            element={
              <ProtectedRoute>
                <Calculator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assistant"
            element={
              <ProtectedRoute>
                <Assistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cook/:id"
            element={
              <ProtectedRoute>
                <CookingMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vet-export/:id"
            element={
              <ProtectedRoute>
                <VetExport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          {/* Public marketing/support pages — the landing page links here for
              logged-out visitors, robots.txt/sitemap list them, and Pricing
              already routes guests to signup on checkout. A ProtectedRoute
              wrapper here was walling off the price list from prospects. */}
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/help" element={<Help />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {showBottomNav && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
